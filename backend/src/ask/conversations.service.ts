import { Injectable, NotFoundException } from '@nestjs/common';
import type { Conversation, ConversationMessage, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { titleFromQuestion } from './conversation-context';
import type { AskCitation } from './citation.resolver';

export type ConversationSummary = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
};

export type ConversationMessageDto = {
  id: string;
  role: 'USER' | 'ASSISTANT';
  content: string;
  status: 'COMPLETED' | 'FAILED';
  citations: AskCitation[];
  insufficientEvidence: boolean | null;
  createdAt: string;
};

export type ConversationDetail = ConversationSummary & {
  messages: ConversationMessageDto[];
  nextCursor: string | null;
};

@Injectable()
export class ConversationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
  ) {}

  async createForClerkUser(
    clerkUserId: string,
    title?: string,
  ): Promise<ConversationSummary> {
    const user = await this.users.findOrCreateByClerkId(clerkUserId);
    const conversation = await this.prisma.conversation.create({
      data: {
        userId: user.id,
        title: (title?.trim() || 'New conversation').slice(0, 120),
      },
    });
    return toSummary(conversation, 0);
  }

  async listForClerkUser(
    clerkUserId: string,
    options?: { limit?: number; cursor?: string },
  ): Promise<{ items: ConversationSummary[]; nextCursor: string | null }> {
    const user = await this.users.findOrCreateByClerkId(clerkUserId);
    const limit = Math.min(Math.max(options?.limit ?? 20, 1), 50);

    const rows = await this.prisma.conversation.findMany({
      where: {
        userId: user.id,
        ...(options?.cursor
          ? {
              updatedAt: {
                lt: (
                  await this.requireOwnedConversation(user.id, options.cursor)
                ).updatedAt,
              },
            }
          : {}),
      },
      orderBy: { updatedAt: 'desc' },
      take: limit + 1,
      include: { _count: { select: { messages: true } } },
    });

    const page = rows.slice(0, limit);
    const next =
      rows.length > limit ? (page[page.length - 1]?.id ?? null) : null;

    return {
      items: page.map((row) => toSummary(row, row._count.messages)),
      nextCursor: next,
    };
  }

  async getForClerkUser(
    clerkUserId: string,
    conversationId: string,
    options?: { limit?: number; before?: string },
  ): Promise<ConversationDetail> {
    const user = await this.users.findOrCreateByClerkId(clerkUserId);
    const conversation = await this.requireOwnedConversation(
      user.id,
      conversationId,
    );
    const limit = Math.min(Math.max(options?.limit ?? 50, 1), 100);

    let beforeCreatedAt: Date | undefined;
    if (options?.before) {
      const pivot = await this.prisma.conversationMessage.findFirst({
        where: { id: options.before, conversationId: conversation.id },
      });
      if (pivot) beforeCreatedAt = pivot.createdAt;
    }

    const messages = await this.prisma.conversationMessage.findMany({
      where: {
        conversationId: conversation.id,
        ...(beforeCreatedAt ? { createdAt: { lt: beforeCreatedAt } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
    });

    const page = messages.slice(0, limit).reverse();
    const nextCursor = messages.length > limit ? (page[0]?.id ?? null) : null;
    const count = await this.prisma.conversationMessage.count({
      where: { conversationId: conversation.id },
    });

    return {
      ...toSummary(conversation, count),
      messages: page.map(toMessageDto),
      nextCursor,
    };
  }

  async deleteForClerkUser(
    clerkUserId: string,
    conversationId: string,
  ): Promise<void> {
    const user = await this.users.findOrCreateByClerkId(clerkUserId);
    await this.requireOwnedConversation(user.id, conversationId);
    await this.prisma.conversation.delete({ where: { id: conversationId } });
  }

  async ensureOwned(
    clerkUserId: string,
    conversationId: string,
  ): Promise<{ userId: string; conversation: Conversation }> {
    const user = await this.users.findOrCreateByClerkId(clerkUserId);
    const conversation = await this.requireOwnedConversation(
      user.id,
      conversationId,
    );
    return { userId: user.id, conversation };
  }

  async createWithTitle(
    userId: string,
    question: string,
  ): Promise<Conversation> {
    return this.prisma.conversation.create({
      data: {
        userId,
        title: titleFromQuestion(question),
      },
    });
  }

  async touch(conversationId: string): Promise<void> {
    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });
  }

  async findIdempotentTurn(
    conversationId: string,
    clientRequestId: string,
  ): Promise<{
    userMessage: ConversationMessage;
    assistantMessage: ConversationMessage | null;
  } | null> {
    const userMessage = await this.prisma.conversationMessage.findFirst({
      where: {
        conversationId,
        clientRequestId,
        role: 'USER',
      },
    });
    if (!userMessage) return null;

    const assistantMessage = await this.prisma.conversationMessage.findFirst({
      where: {
        conversationId,
        role: 'ASSISTANT',
        createdAt: { gt: userMessage.createdAt },
      },
      orderBy: { createdAt: 'asc' },
    });

    return { userMessage, assistantMessage };
  }

  async persistUserMessage(params: {
    conversationId: string;
    content: string;
    clientRequestId?: string;
  }): Promise<ConversationMessage> {
    try {
      return await this.prisma.conversationMessage.create({
        data: {
          conversationId: params.conversationId,
          role: 'USER',
          content: params.content,
          status: 'COMPLETED',
          clientRequestId: params.clientRequestId,
        },
      });
    } catch (error) {
      if (params.clientRequestId && isUniqueViolation(error)) {
        const existing = await this.prisma.conversationMessage.findFirst({
          where: {
            conversationId: params.conversationId,
            clientRequestId: params.clientRequestId,
            role: 'USER',
          },
        });
        if (existing) return existing;
      }
      throw error;
    }
  }

  async persistAssistantMessage(params: {
    conversationId: string;
    content: string;
    status: 'COMPLETED' | 'FAILED';
    citations: AskCitation[];
    insufficientEvidence: boolean;
    replaceId?: string;
  }): Promise<ConversationMessage> {
    const data = {
      content: params.content,
      status: params.status,
      citations: params.citations as Prisma.InputJsonValue,
      insufficientEvidence: params.insufficientEvidence,
    };
    const message = params.replaceId
      ? await this.prisma.conversationMessage.update({
          where: { id: params.replaceId },
          data,
        })
      : await this.prisma.conversationMessage.create({
          data: {
            conversationId: params.conversationId,
            role: 'ASSISTANT',
            ...data,
          },
        });
    await this.touch(params.conversationId);
    return message;
  }

  async loadRecentHistory(
    conversationId: string,
    excludeMessageId?: string,
  ): Promise<ConversationMessage[]> {
    const maxMessages = Math.max(
      0,
      Math.floor(Number(process.env.ASK_HISTORY_MAX_MESSAGES ?? 8)),
    );
    if (maxMessages === 0) return [];

    return this.prisma.conversationMessage.findMany({
      where: {
        conversationId,
        status: 'COMPLETED',
        ...(excludeMessageId ? { id: { not: excludeMessageId } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: maxMessages,
    });
  }

  private async requireOwnedConversation(
    userId: string,
    conversationId: string,
  ): Promise<Conversation> {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
    });
    if (!conversation) {
      throw new NotFoundException({
        error: {
          code: 'CONVERSATION_NOT_FOUND',
          message: 'Conversation not found.',
        },
      });
    }
    if (conversation.userId !== userId) {
      throw new NotFoundException({
        error: {
          code: 'CONVERSATION_NOT_FOUND',
          message: 'Conversation not found.',
        },
      });
    }
    return conversation;
  }
}

function toSummary(
  conversation: Conversation,
  messageCount: number,
): ConversationSummary {
  return {
    id: conversation.id,
    title: conversation.title,
    createdAt: conversation.createdAt.toISOString(),
    updatedAt: conversation.updatedAt.toISOString(),
    messageCount,
  };
}

function toMessageDto(message: ConversationMessage): ConversationMessageDto {
  return {
    id: message.id,
    role: message.role,
    content: message.content,
    status: message.status,
    citations: parseCitations(message.citations),
    insufficientEvidence: message.insufficientEvidence,
    createdAt: message.createdAt.toISOString(),
  };
}

function parseCitations(value: Prisma.JsonValue | null): AskCitation[] {
  if (!Array.isArray(value)) return [];
  const out: AskCitation[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    if (
      typeof row.observationId !== 'string' ||
      typeof row.chunkId !== 'string' ||
      typeof row.title !== 'string' ||
      typeof row.snippet !== 'string' ||
      typeof row.createdAt !== 'string'
    ) {
      continue;
    }
    out.push({
      observationId: row.observationId,
      chunkId: row.chunkId,
      title: row.title,
      snippet: row.snippet,
      createdAt: row.createdAt,
    });
  }
  return out;
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: string }).code === 'P2002'
  );
}
