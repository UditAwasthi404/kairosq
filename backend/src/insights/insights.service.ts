import { Inject, Injectable } from '@nestjs/common';
import { CaptureSource, ProcessingStatus } from '@prisma/client';
import { AI_PROVIDER, type AIProvider } from '../ai/ai.types';
import { CAPTURE_SOURCE_LABELS } from '../observations/capture-source';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import {
  HISTORY_DAYS,
  addDays,
  buildDashboardRhythm,
  type ActivityDay,
  type CaptureHabit,
  type CaptureStreak,
  type HeatmapDay,
} from './insights.rhythm';

export type KnowledgeMaturity = 'single' | 'repeated' | 'pattern' | 'stable';

export type InsightEvidence = {
  observationId: string;
  filename: string;
  snippet: string;
  capturedAt: string;
  sourceLabel: string;
  topicName?: string;
};

export type TodayInsight = {
  title: string;
  body: string;
  generatedAt: string;
  observationCount: number;
  empty: boolean;
  evidence: InsightEvidence[];
  why: string;
  maturity: KnowledgeMaturity;
};

export type DashboardSummary = {
  greeting: string;
  daySummary: string;
  todayCount: number;
  weekCount: number;
  todayTopicCount: number;
  todayProjectCount: number;
  processingCount: number;
  completedCount: number;
  totalCount: number;
  insight: TodayInsight;
  sources: Array<{ source: CaptureSource; label: string; count: number }>;
  topics: Array<{ id: string; name: string; observationCount: number }>;
  activity: ActivityDay[];
  heatmap: HeatmapDay[];
  streak: CaptureStreak;
  habit: CaptureHabit;
  recent: Array<{
    id: string;
    filename: string;
    source: CaptureSource;
    sourceLabel: string;
    capturedAt: string;
    summary: string | null;
    status: ProcessingStatus;
  }>;
};

export type PredictionItem = {
  kind: 'revisit' | 'focus' | 'emerging' | 'next';
  title: string;
  body: string;
  why: string;
  topicId?: string;
  observationId?: string;
  mentionCount?: number;
  dayCount?: number;
  maturity: KnowledgeMaturity;
  evidence: InsightEvidence[];
};

export type PredictionsSummary = {
  generatedAt: string;
  empty: boolean;
  items: PredictionItem[];
};

export type DailyBrief = {
  title: string;
  generatedAt: string;
  empty: boolean;
  yesterdayCount: number;
  weekCount: number;
  attentionTopics: Array<{ id: string; name: string; observationCount: number }>;
  noticed: TodayInsight;
  revisit: PredictionItem | null;
};

@Injectable()
export class InsightsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
    @Inject(AI_PROVIDER) private readonly ai: AIProvider,
  ) {}

  async todayForClerkUser(clerkUserId: string): Promise<TodayInsight> {
    const user = await this.users.findOrCreateByClerkId(clerkUserId);
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const observations = await this.prisma.observation.findMany({
      where: {
        userId: user.id,
        processingStatus: ProcessingStatus.COMPLETED,
        capturedAt: { gte: since },
      },
      orderBy: { capturedAt: 'desc' },
      take: 12,
      select: {
        id: true,
        summary: true,
        extractedText: true,
        originalFilename: true,
        source: true,
        capturedAt: true,
        observationTopics: { include: { topic: true } },
      },
    });

    const generatedAt = new Date().toISOString();
    const evidence = observations.slice(0, 5).map(toEvidence);
    if (observations.length === 0) {
      return {
        title: 'Something I noticed',
        body: 'Capture something today and Kairos will start finding patterns.',
        generatedAt,
        observationCount: 0,
        empty: true,
        evidence: [],
        why: 'No completed memories in the last 7 days.',
        maturity: 'single',
      };
    }

    const snippets = observations
      .map((item) => {
        const text = (item.summary || item.extractedText || '').trim();
        return text ? `${item.source}: ${text.slice(0, 280)}` : null;
      })
      .filter((item): item is string => Boolean(item));
    const topicCounts = countTopicsFromRows(observations);
    const focus = [...topicCounts.entries()].sort((a, b) => b[1].count - a[1].count)[0];
    const dayCount = uniqueDayCount(observations.map((item) => item.capturedAt));
    const maturity = maturityFor(observations.length, dayCount);

    if (this.ai.isConfigured() && snippets.length > 0) {
      try {
        const analysis = await this.ai.analyzeDocument([
          `Write one short personal observation (2 sentences max) about what this person has been spending attention on recently. Be concrete. Do not invent facts. Use cautious language such as "I've noticed" or "You may be".\n\nRecent memories:\n${snippets.join('\n')}`,
        ]);
        const body = analysis.summary.trim();
        if (body) {
          return {
            title: 'Something I noticed',
            body,
            generatedAt,
            observationCount: observations.length,
            empty: false,
            evidence,
            why: whyLine(observations.length, dayCount, focus?.[1].name),
            maturity,
          };
        }
      } catch {
        // Fall back to latest summary.
      }
    }

    const latest =
      snippets[0] ||
      observations[0].originalFilename ||
      'Recent captures are still settling.';
    const body = focus
      ? `I've noticed you returning to ${focus[1].name} across ${focus[1].count} of ${observations.length} recent memories.`
      : latest.replace(/^[A-Z_]+:\s*/, '');
    return {
      title: 'Something I noticed',
      body,
      generatedAt,
      observationCount: observations.length,
      empty: false,
      evidence,
      why: whyLine(observations.length, dayCount, focus?.[1].name),
      maturity,
    };
  }

  async dashboardForClerkUser(clerkUserId: string): Promise<DashboardSummary> {
    const user = await this.users.findOrCreateByClerkId(clerkUserId);
    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const historyStart = addDays(startOfDay, -(HISTORY_DAYS - 1));
    const [
      total,
      todayCount,
      weekCount,
      processingCount,
      completedCount,
      sources,
      topics,
      recent,
      todayMeta,
      capturedDates,
    ] = await Promise.all([
        this.prisma.observation.count({ where: { userId: user.id } }),
        this.prisma.observation.count({
          where: { userId: user.id, capturedAt: { gte: startOfDay } },
        }),
        this.prisma.observation.count({
          where: { userId: user.id, capturedAt: { gte: weekAgo } },
        }),
        this.prisma.observation.count({
          where: {
            userId: user.id,
            processingStatus: { notIn: [ProcessingStatus.COMPLETED, ProcessingStatus.FAILED] },
          },
        }),
        this.prisma.observation.count({
          where: { userId: user.id, processingStatus: ProcessingStatus.COMPLETED },
        }),
        this.prisma.observation.groupBy({
          by: ['source'],
          where: { userId: user.id },
          _count: { _all: true },
        }),
        this.prisma.topic.findMany({
          where: { userId: user.id },
          orderBy: { updatedAt: 'desc' },
          take: 8,
          include: { _count: { select: { observationTopics: true } } },
        }),
        this.prisma.observation.findMany({
          where: { userId: user.id },
          orderBy: { capturedAt: 'desc' },
          take: 6,
          select: {
            id: true,
            originalFilename: true,
            source: true,
            capturedAt: true,
            summary: true,
            processingStatus: true,
          },
        }),
        this.prisma.observation.findMany({
          where: { userId: user.id, capturedAt: { gte: startOfDay } },
          select: {
            observationTopics: { select: { topicId: true } },
            projectObservations: { select: { projectId: true } },
          },
        }),
        this.prisma.observation.findMany({
          where: { userId: user.id, capturedAt: { gte: historyStart } },
          select: { capturedAt: true },
        }),
      ]);
    const rhythm = buildDashboardRhythm({
      capturedAt: capturedDates.map((row) => row.capturedAt),
      now,
      todayCount,
    });

    const insight = await this.todayForClerkUser(clerkUserId);
    const todayTopicCount = new Set(
      todayMeta.flatMap((row) => (row.observationTopics ?? []).map((item) => item.topicId)),
    ).size;
    const todayProjectCount = new Set(
      todayMeta.flatMap((row) =>
        (row.projectObservations ?? []).map((item) => item.projectId),
      ),
    ).size;
    const hour = now.getHours();
    const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

    return {
      greeting,
      daySummary: `${todayCount} ${plural(todayCount, 'memory', 'memories')} · ${todayTopicCount} ${plural(todayTopicCount, 'topic', 'topics')} · ${todayProjectCount} ${plural(todayProjectCount, 'project', 'projects')}`,
      todayCount,
      weekCount,
      todayTopicCount,
      todayProjectCount,
      processingCount,
      completedCount,
      totalCount: total,
      insight,
      sources: sources
        .map((row) => ({
          source: row.source,
          label: CAPTURE_SOURCE_LABELS[row.source] || row.source,
          count: row._count._all,
        }))
        .sort((a, b) => b.count - a.count),
      topics: topics.map((topic) => ({
        id: topic.id,
        name: topic.name,
        observationCount: topic._count.observationTopics,
      })),
      activity: rhythm.activity,
      heatmap: rhythm.heatmap,
      streak: rhythm.streak,
      habit: rhythm.habit,
      recent: recent.map((item) => ({
        id: item.id,
        filename: item.originalFilename,
        source: item.source,
        sourceLabel: CAPTURE_SOURCE_LABELS[item.source] || item.source,
        capturedAt: item.capturedAt.toISOString(),
        summary: item.summary,
        status: item.processingStatus,
      })),
    };
  }

  async predictionsForClerkUser(clerkUserId: string): Promise<PredictionsSummary> {
    const user = await this.users.findOrCreateByClerkId(clerkUserId);
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);

    const [recent, older, stale] = await Promise.all([
      this.prisma.observation.findMany({
        where: {
          userId: user.id,
          processingStatus: ProcessingStatus.COMPLETED,
          capturedAt: { gte: weekAgo },
        },
        orderBy: { capturedAt: 'desc' },
        take: 40,
        include: {
          observationTopics: { include: { topic: true } },
        },
      }),
      this.prisma.observation.findMany({
        where: {
          userId: user.id,
          processingStatus: ProcessingStatus.COMPLETED,
          capturedAt: { gte: twoWeeksAgo, lt: weekAgo },
        },
        take: 40,
        include: {
          observationTopics: { include: { topic: true } },
        },
      }),
      this.prisma.observation.findFirst({
        where: {
          userId: user.id,
          processingStatus: ProcessingStatus.COMPLETED,
          capturedAt: { lt: weekAgo },
        },
        orderBy: { capturedAt: 'asc' },
        include: {
          observationTopics: { include: { topic: true } },
        },
      }),
    ]);

    const generatedAt = new Date().toISOString();
    if (recent.length === 0 && !stale) {
      return {
        generatedAt,
        empty: true,
        items: [
          {
            kind: 'next',
            title: 'Start a pattern',
            body: 'Capture a few thoughts this week and Kairos will notice what you are likely to revisit.',
            why: 'There are not enough completed memories yet.',
            maturity: 'single',
            evidence: [],
          },
        ],
      };
    }

    const recentTopics = countTopics(recent);
    const olderTopics = countTopics(older);
    const focus = [...recentTopics.entries()].sort((a, b) => b[1].count - a[1].count)[0];
    const emerging = [...recentTopics.entries()].find(
      ([name, value]) => value.count >= 2 && !olderTopics.has(name),
    );
    const items: PredictionItem[] = [];

    if (focus) {
      const supporting = recent.filter((item) =>
        item.observationTopics.some((row) => row.topic.name.toLowerCase() === focus[0]),
      );
      const dayCount = uniqueDayCount(supporting.map((item) => item.capturedAt));
      items.push({
        kind: 'focus',
        title: `You may be leaning into ${focus[1].name}`,
        body: `I've noticed ${focus[1].name} in ${focus[1].count} memories this week.`,
        why: `${focus[1].count} mentions · ${dayCount} days · last 7 days`,
        topicId: focus[1].id,
        mentionCount: focus[1].count,
        dayCount,
        maturity: maturityFor(focus[1].count, dayCount),
        evidence: supporting.slice(0, 5).map(toEvidence),
      });
    }
    if (emerging) {
      const supporting = recent.filter((item) =>
        item.observationTopics.some((row) => row.topic.name.toLowerCase() === emerging[0]),
      );
      items.push({
        kind: 'emerging',
        title: `${emerging[1].name} appeared this week`,
        body: 'This topic showed up recently and did not appear in the week before. It is worth watching — not a settled pattern yet.',
        why: `${emerging[1].count} mentions · new this week`,
        topicId: emerging[1].id,
        mentionCount: emerging[1].count,
        dayCount: uniqueDayCount(supporting.map((item) => item.capturedAt)),
        maturity: 'repeated',
        evidence: supporting.slice(0, 5).map(toEvidence),
      });
    }
    if (stale) {
      const topicName = stale.observationTopics[0]?.topic.name;
      items.push({
        kind: 'revisit',
        title: topicName ? `You may want to revisit ${topicName}` : 'Something older is waiting',
        body: `You have not come back to “${stale.originalFilename}” in over a week.`,
        why: 'Oldest completed memory that has been quiet for 7+ days.',
        observationId: stale.id,
        topicId: stale.observationTopics[0]?.topic.id,
        maturity: 'single',
        evidence: [toEvidence(stale)],
      });
    }
    if (focus) {
      const supporting = recent.filter((item) =>
        item.observationTopics.some((row) => row.topic.name.toLowerCase() === focus[0]),
      );
      items.push({
        kind: 'next',
        title: `Likely next thread: ${focus[1].name}`,
        body: `Based on this week, your next capture may stay on ${focus[1].name} unless you deliberately switch.`,
        why: `${focus[1].count} of ${recent.length} recent memories mention ${focus[1].name}.`,
        topicId: focus[1].id,
        mentionCount: focus[1].count,
        maturity: maturityFor(focus[1].count, uniqueDayCount(supporting.map((item) => item.capturedAt))),
        evidence: supporting.slice(0, 5).map(toEvidence),
      });
    }

    if (this.ai.isConfigured() && recent.length > 0) {
      const snippets = recent
        .map((item) => (item.summary || item.extractedText || '').trim().slice(0, 180))
        .filter(Boolean)
        .slice(0, 10);
      try {
        const analysis = await this.ai.analyzeDocument([
          `From these personal memories, write one cautious prediction about what this person may revisit or work on next. Two sentences max. Do not invent facts. Do not claim certainty.\n\n${snippets.join('\n')}`,
        ]);
        if (analysis.summary.trim()) {
          items.unshift({
            kind: 'next',
            title: 'Something I noticed',
            body: analysis.summary.trim(),
            why: `Based on ${recent.length} completed memories from the last 7 days.`,
            maturity: maturityFor(recent.length, uniqueDayCount(recent.map((item) => item.capturedAt))),
            evidence: recent.slice(0, 5).map(toEvidence),
          });
        }
      } catch {
        // Heuristic items are enough.
      }
    }

    return {
      generatedAt,
      empty: items.length === 0,
      items: items.slice(0, 6),
    };
  }

  async briefForClerkUser(clerkUserId: string): Promise<DailyBrief> {
    const user = await this.users.findOrCreateByClerkId(clerkUserId);
    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    const startOfYesterday = new Date(startOfDay);
    startOfYesterday.setDate(startOfYesterday.getDate() - 1);
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [yesterdayCount, weekCount, weekTopics, noticed, predictions] = await Promise.all([
      this.prisma.observation.count({
        where: {
          userId: user.id,
          capturedAt: { gte: startOfYesterday, lt: startOfDay },
        },
      }),
      this.prisma.observation.count({
        where: { userId: user.id, capturedAt: { gte: weekAgo } },
      }),
      this.prisma.topic.findMany({
        where: {
          userId: user.id,
          observationTopics: {
            some: { observation: { userId: user.id, capturedAt: { gte: weekAgo } } },
          },
        },
        take: 5,
        include: { _count: { select: { observationTopics: true } } },
        orderBy: { updatedAt: 'desc' },
      }),
      this.todayForClerkUser(clerkUserId),
      this.predictionsForClerkUser(clerkUserId),
    ]);

    return {
      title: 'Your Kairos brief',
      generatedAt: new Date().toISOString(),
      empty: weekCount === 0,
      yesterdayCount,
      weekCount,
      attentionTopics: weekTopics.map((topic) => ({
        id: topic.id,
        name: topic.name,
        observationCount: topic._count.observationTopics,
      })),
      noticed,
      revisit: predictions.items.find((item) => item.kind === 'revisit') ?? null,
    };
  }
}

function toEvidence(item: {
  id: string;
  originalFilename: string;
  summary?: string | null;
  extractedText?: string | null;
  source: CaptureSource;
  capturedAt: Date;
  observationTopics?: Array<{ topic: { name: string } }>;
}): InsightEvidence {
  const snippet = (item.summary || item.extractedText || item.originalFilename)
    .trim()
    .slice(0, 180);
  return {
    observationId: item.id,
    filename: item.originalFilename,
    snippet,
    capturedAt: item.capturedAt.toISOString(),
    sourceLabel: CAPTURE_SOURCE_LABELS[item.source] || item.source,
    topicName: item.observationTopics?.[0]?.topic.name,
  };
}

function whyLine(count: number, days: number, topic?: string): string {
  const base = `Based on ${count} ${plural(count, 'memory', 'memories')} across ${days} ${plural(days, 'day', 'days')}`;
  return topic ? `${base} · strongest thread: ${topic}` : base;
}

function maturityFor(count: number, days: number): KnowledgeMaturity {
  if (count <= 1) return 'single';
  if (count <= 2) return 'repeated';
  if (count >= 5 && days >= 7) return 'stable';
  return 'pattern';
}

function uniqueDayCount(dates: Date[]): number {
  return new Set(dates.map((date) => date.toISOString().slice(0, 10))).size;
}

function plural(count: number, one: string, many: string): string {
  return count === 1 ? one : many;
}

function countTopics(
  observations: Array<{
    observationTopics: Array<{ topic: { id: string; name: string } }>;
  }>,
): Map<string, { id: string; name: string; count: number }> {
  return countTopicsFromRows(observations);
}

function countTopicsFromRows(
  observations: Array<{
    observationTopics: Array<{ topic: { id: string; name: string } }>;
  }>,
): Map<string, { id: string; name: string; count: number }> {
  const map = new Map<string, { id: string; name: string; count: number }>();
  for (const observation of observations) {
    for (const row of observation.observationTopics ?? []) {
      const key = row.topic.name.toLowerCase();
      const current = map.get(key);
      if (current) current.count += 1;
      else map.set(key, { id: row.topic.id, name: row.topic.name, count: 1 });
    }
  }
  return map;
}
