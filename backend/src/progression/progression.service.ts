import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ProgressionAction, type UserProgression } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { dayKey } from '../insights/insights.rhythm';
import {
  COSMETIC_CATALOG,
  FREEZE_KEEP_COST,
  cosmeticLabel,
  unlocksForStreak,
} from './cosmetics';
import { levelFromXp } from './level.engine';
import {
  REWARD_POLICY,
  type ProgressionActionKind,
  type RewardPolicy,
  type RewardRoll,
} from './reward.policy';
import { advanceStreak } from './streak.engine';

export type ProgressionView = {
  xp: number;
  level: number;
  intoLevel: number;
  nextLevelXp: number;
  progress: number;
  keeps: number;
  currentStreak: number;
  longestStreak: number;
  lastActiveDate: string | null;
  freezeTokens: number;
  freezeCost: number;
  equippedTitle: string | null;
  equippedAura: string | null;
  equippedTitleLabel: string | null;
  equippedAuraLabel: string | null;
  leaderboardVisible: boolean;
  displayName: string | null;
  unlocks: Array<{
    key: string;
    kind: string;
    label: string;
    streakGated: boolean;
    available: boolean;
  }>;
  lastEvent: ProgressionEventView | null;
};

export type ProgressionEventView = {
  action: ProgressionActionKind;
  xpAwarded: number;
  keepsAwarded: number;
  multiplier: number;
  bonus: boolean;
  freezeUsed: number;
  streakAfter: number;
  firstOfDay: boolean;
  broke: boolean;
  replayed: boolean;
};

export type LeaderboardRow = {
  rank: number;
  userId: string;
  displayName: string;
  level: number;
  xp: number;
  currentStreak: number;
  title: string | null;
  self: boolean;
};

export type LeaderboardView = {
  scope: 'global' | 'circle';
  visible: boolean;
  selfRank: number | null;
  rows: LeaderboardRow[];
};

@Injectable()
export class ProgressionService {
  private readonly logger = new Logger(ProgressionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
    @Inject(REWARD_POLICY) private readonly rewards: RewardPolicy,
  ) {}

  async getForClerkUser(clerkUserId: string, displayName?: string): Promise<ProgressionView> {
    const user = await this.users.findOrCreateByClerkId(clerkUserId);
    const row = await this.ensureRow(user.id, displayName);
    return this.toView(row, null);
  }

  async patchForClerkUser(
    clerkUserId: string,
    patch: {
      leaderboardVisible?: boolean;
      displayName?: string;
      equippedTitle?: string;
      equippedAura?: string;
    },
  ): Promise<ProgressionView> {
    const user = await this.users.findOrCreateByClerkId(clerkUserId);
    const row = await this.ensureRow(user.id, patch.displayName);
    const unlockKeys = new Set(row.unlocks.map((item) => item.key));
    if (patch.equippedTitle && !unlockKeys.has(patch.equippedTitle)) {
      throw new BadRequestException({
        error: { code: 'LOCKED_COSMETIC', message: 'That title is not unlocked yet.' },
      });
    }
    if (patch.equippedAura && !unlockKeys.has(patch.equippedAura)) {
      throw new BadRequestException({
        error: { code: 'LOCKED_COSMETIC', message: 'That aura is not unlocked yet.' },
      });
    }
    const next = await this.prisma.userProgression.update({
      where: { id: row.id },
      data: {
        ...(patch.leaderboardVisible != null
          ? { leaderboardVisible: patch.leaderboardVisible }
          : {}),
        ...(patch.displayName != null ? { displayName: patch.displayName } : {}),
        ...(patch.equippedTitle !== undefined ? { equippedTitle: patch.equippedTitle } : {}),
        ...(patch.equippedAura !== undefined ? { equippedAura: patch.equippedAura } : {}),
      },
      include: { unlocks: true, events: { orderBy: { createdAt: 'desc' }, take: 1 } },
    });
    return this.toView(next, null);
  }

  async buyFreeze(clerkUserId: string): Promise<ProgressionView> {
    const user = await this.users.findOrCreateByClerkId(clerkUserId);
    await this.ensureRow(user.id);
    const result = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT id FROM user_progression WHERE "userId" = ${user.id} FOR UPDATE`;
      const row = await tx.userProgression.findUniqueOrThrow({
        where: { userId: user.id },
        include: { unlocks: true },
      });
      if (row.keeps < FREEZE_KEEP_COST) {
        throw new BadRequestException({
          error: {
            code: 'NOT_ENOUGH_KEEPS',
            message: `A freeze costs ${FREEZE_KEEP_COST} keeps.`,
          },
        });
      }
      const key = `freeze.buy.${Date.now()}`;
      const updated = await tx.userProgression.update({
        where: { id: row.id },
        data: {
          keeps: { decrement: FREEZE_KEEP_COST },
          freezeTokens: { increment: 1 },
          events: {
            create: {
              idempotencyKey: key,
              action: ProgressionAction.FREEZE,
              xpAwarded: 0,
              keepsAwarded: -FREEZE_KEEP_COST,
              multiplier: 1,
              bonus: false,
              freezeUsed: 0,
              streakAfter: row.currentStreak,
            },
          },
        },
        include: { unlocks: true, events: { orderBy: { createdAt: 'desc' }, take: 1 } },
      });
      return updated;
    });
    return this.toView(result, {
      action: 'FREEZE',
      xpAwarded: 0,
      keepsAwarded: -FREEZE_KEEP_COST,
      multiplier: 1,
      bonus: false,
      freezeUsed: 0,
      streakAfter: result.currentStreak,
      firstOfDay: false,
      broke: false,
      replayed: false,
    });
  }

  async recordCapture(params: {
    userId: string;
    observationId: string;
    now?: Date;
  }): Promise<ProgressionEventView> {
    return this.recordEvent({
      userId: params.userId,
      action: 'CAPTURE',
      idempotencyKey: `capture:${params.observationId}`,
      now: params.now,
    });
  }

  async recordEvent(params: {
    userId: string;
    action: ProgressionActionKind;
    idempotencyKey: string;
    now?: Date;
    displayName?: string;
  }): Promise<ProgressionEventView> {
    await this.ensureRow(params.userId, params.displayName);
    const today = dayKey(params.now ?? new Date());

    try {
      return await this.prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT id FROM user_progression WHERE "userId" = ${params.userId} FOR UPDATE`;
        const row = await tx.userProgression.findUniqueOrThrow({
          where: { userId: params.userId },
          include: { unlocks: true },
        });

        const existing = await tx.progressionEvent.findUnique({
          where: {
            progressionId_idempotencyKey: {
              progressionId: row.id,
              idempotencyKey: params.idempotencyKey,
            },
          },
        });
        if (existing) {
          return {
            action: existing.action,
            xpAwarded: existing.xpAwarded,
            keepsAwarded: existing.keepsAwarded,
            multiplier: existing.multiplier,
            bonus: existing.bonus,
            freezeUsed: existing.freezeUsed,
            streakAfter: existing.streakAfter,
            firstOfDay: false,
            broke: false,
            replayed: true,
          };
        }

        const roll = this.rewards.roll(params.action);
        const streak = advanceStreak(
          {
            currentStreak: row.currentStreak,
            longestStreak: row.longestStreak,
            lastActiveDate: row.lastActiveDate,
            freezeTokens: row.freezeTokens,
          },
          today,
        );

        const nextUnlocks = unlocksForStreak(streak.currentStreak).filter(
          (item) => !row.unlocks.some((owned) => owned.key === item.key),
        );
        const freezeFromUnlocks = nextUnlocks.filter((item) => item.kind === 'freeze').length;
        const equipped = nextEquipment(row, streak, nextUnlocks);

        const updated = await tx.userProgression.update({
          where: { id: row.id },
          data: {
            xp: { increment: roll.xp },
            keeps: { increment: roll.keeps },
            level: levelFromXp(row.xp + roll.xp).level,
            currentStreak: streak.currentStreak,
            longestStreak: streak.longestStreak,
            lastActiveDate: streak.lastActiveDate,
            freezeTokens: streak.freezeTokens + freezeFromUnlocks,
            equippedTitle: equipped.title,
            equippedAura: equipped.aura,
            events: {
              create: {
                idempotencyKey: params.idempotencyKey,
                action: params.action,
                xpAwarded: roll.xp,
                keepsAwarded: roll.keeps,
                multiplier: roll.multiplier,
                bonus: roll.bonus,
                freezeUsed: streak.freezeUsed,
                streakAfter: streak.currentStreak,
              },
            },
            unlocks: {
              create: nextUnlocks.map((item) => ({
                key: item.key,
                kind: item.kind,
                streakGated: item.streakGated,
                streakAtUnlock: streak.currentStreak,
              })),
            },
          },
        });

        return toEventView(params.action, roll, streak, updated.currentStreak, false);
      });
    } catch (error) {
      this.logger.warn(`Progression event failed: ${String(error)}`);
      throw error;
    }
  }

  async leaderboardForClerkUser(
    clerkUserId: string,
    scope: 'global' | 'circle',
  ): Promise<LeaderboardView> {
    const user = await this.users.findOrCreateByClerkId(clerkUserId);
    const self = await this.ensureRow(user.id);
    const peerIds =
      scope === 'circle'
        ? (
            await this.prisma.progressionPeer.findMany({
              where: { ownerId: user.id },
              select: { peerId: true },
            })
          ).map((row) => row.peerId)
        : [];

    const where =
      scope === 'circle'
        ? {
            leaderboardVisible: true,
            userId: { in: [...peerIds, user.id] },
          }
        : { leaderboardVisible: true };

    const rows = await this.prisma.userProgression.findMany({
      where,
      orderBy: [{ xp: 'desc' }, { updatedAt: 'asc' }],
      take: 40,
      select: {
        userId: true,
        xp: true,
        level: true,
        currentStreak: true,
        displayName: true,
        equippedTitle: true,
      },
    });

    const mapped = rows.map((row, index) => ({
      rank: index + 1,
      userId: row.userId,
      displayName: publicName(row.displayName, row.userId),
      level: row.level,
      xp: row.xp,
      currentStreak: row.currentStreak,
      title: cosmeticLabel(row.equippedTitle),
      self: row.userId === user.id,
    }));

    const selfRank = self.leaderboardVisible
      ? (mapped.find((row) => row.self)?.rank ??
        (await this.rankForXp(self.xp, self.updatedAt)))
      : null;

    return {
      scope,
      visible: self.leaderboardVisible,
      selfRank,
      rows: mapped,
    };
  }

  async addPeer(clerkUserId: string, peerUserId: string): Promise<void> {
    const user = await this.users.findOrCreateByClerkId(clerkUserId);
    if (user.id === peerUserId) {
      throw new BadRequestException({
        error: { code: 'INVALID_PEER', message: 'You cannot add yourself.' },
      });
    }
    const peer = await this.prisma.user.findUnique({ where: { id: peerUserId } });
    if (!peer) {
      throw new BadRequestException({
        error: { code: 'PEER_NOT_FOUND', message: 'That person is not on Kairos yet.' },
      });
    }
    await this.prisma.progressionPeer.upsert({
      where: { ownerId_peerId: { ownerId: user.id, peerId: peer.id } },
      create: { ownerId: user.id, peerId: peer.id },
      update: {},
    });
  }

  private async rankForXp(xp: number, updatedAt: Date): Promise<number> {
    const ahead = await this.prisma.userProgression.count({
      where: {
        leaderboardVisible: true,
        OR: [
          { xp: { gt: xp } },
          { xp, updatedAt: { lt: updatedAt } },
        ],
      },
    });
    return ahead + 1;
  }

  private async ensureRow(userId: string, displayName?: string) {
    return this.prisma.userProgression.upsert({
      where: { userId },
      create: {
        userId,
        ...(displayName ? { displayName } : {}),
      },
      update: displayName && displayName.length > 0 ? { displayName } : {},
      include: { unlocks: true, events: { orderBy: { createdAt: 'desc' }, take: 1 } },
    });
  }

  private toView(
    row: UserProgression & {
      unlocks: Array<{ key: string; kind: string; streakGated: boolean }>;
      events?: Array<{
        action: ProgressionAction;
        xpAwarded: number;
        keepsAwarded: number;
        multiplier: number;
        bonus: boolean;
        freezeUsed: number;
        streakAfter: number;
      }>;
    },
    lastEvent: ProgressionEventView | null,
  ): ProgressionView {
    const level = levelFromXp(row.xp);
    const owned = new Set(row.unlocks.map((item) => item.key));
    const last = lastEvent ?? (row.events?.[0] ? eventFromRow(row.events[0]) : null);
    return {
      xp: row.xp,
      level: level.level,
      intoLevel: level.intoLevel,
      nextLevelXp: level.nextLevelXp,
      progress: level.progress,
      keeps: row.keeps,
      currentStreak: row.currentStreak,
      longestStreak: row.longestStreak,
      lastActiveDate: row.lastActiveDate,
      freezeTokens: row.freezeTokens,
      freezeCost: FREEZE_KEEP_COST,
      equippedTitle: row.equippedTitle,
      equippedAura: row.equippedAura,
      equippedTitleLabel: cosmeticLabel(row.equippedTitle),
      equippedAuraLabel: cosmeticLabel(row.equippedAura),
      leaderboardVisible: row.leaderboardVisible,
      displayName: row.displayName,
      unlocks: COSMETIC_CATALOG.map((item) => ({
        key: item.key,
        kind: item.kind,
        label: item.label,
        streakGated: item.streakGated,
        available: owned.has(item.key) && (!item.streakGated || row.currentStreak >= item.streakAt),
      })),
      lastEvent: last,
    };
  }
}

function publicName(displayName: string | null, userId: string): string {
  if (displayName?.trim()) return displayName.trim();
  return `Keeper ${userId.slice(-4).toUpperCase()}`;
}

function nextEquipment(
  row: UserProgression,
  streak: { broke: boolean; currentStreak: number },
  fresh: Array<{ key: string; kind: string; streakGated: boolean }>,
): { title: string | null; aura: string | null } {
  if (streak.broke) {
    return { title: null, aura: null };
  }
  const title =
    row.equippedTitle ??
    fresh.find((item) => item.kind === 'title')?.key ??
    null;
  const aura =
    row.equippedAura ??
    fresh.find((item) => item.kind === 'aura')?.key ??
    null;
  return { title, aura };
}

function toEventView(
  action: ProgressionActionKind,
  roll: RewardRoll,
  streak: { freezeUsed: number; firstOfDay: boolean; broke: boolean },
  streakAfter: number,
  replayed: boolean,
): ProgressionEventView {
  return {
    action,
    xpAwarded: roll.xp,
    keepsAwarded: roll.keeps,
    multiplier: roll.multiplier,
    bonus: roll.bonus,
    freezeUsed: streak.freezeUsed,
    streakAfter,
    firstOfDay: streak.firstOfDay,
    broke: streak.broke,
    replayed,
  };
}

function eventFromRow(event: {
  action: ProgressionAction;
  xpAwarded: number;
  keepsAwarded: number;
  multiplier: number;
  bonus: boolean;
  freezeUsed: number;
  streakAfter: number;
}): ProgressionEventView {
  return {
    action: event.action,
    xpAwarded: event.xpAwarded,
    keepsAwarded: event.keepsAwarded,
    multiplier: event.multiplier,
    bonus: event.bonus,
    freezeUsed: event.freezeUsed,
    streakAfter: event.streakAfter,
    firstOfDay: false,
    broke: false,
    replayed: false,
  };
}
