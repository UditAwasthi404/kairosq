import {
  CanActivate,
  ExecutionContext,
  NotFoundException,
  INestApplication,
  UnauthorizedException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AuthGuard } from '../auth/auth.guard';
import { ConversationsController } from './conversations.controller';
import { ConversationsService } from './conversations.service';
import { AskService } from './ask.service';

class TestAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<{
      headers: { authorization?: string };
      user?: { id: string; authenticated: true };
    }>();
    if (!req.headers.authorization?.startsWith('Bearer valid-token')) {
      throw new UnauthorizedException();
    }
    req.user = { id: 'clerk_user_a', authenticated: true };
    return true;
  }
}

describe('ConversationsController', () => {
  let app: INestApplication<App>;
  const conversations = {
    createForClerkUser: jest.fn(),
    listForClerkUser: jest.fn(),
    getForClerkUser: jest.fn(),
    deleteForClerkUser: jest.fn(),
  };
  const ask = jest.fn();

  beforeEach(async () => {
    jest.resetAllMocks();
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [ConversationsController],
      providers: [
        { provide: ConversationsService, useValue: conversations },
        { provide: AskService, useValue: { ask } },
      ],
    })
      .overrideGuard(AuthGuard)
      .useClass(TestAuthGuard)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('rejects unauthenticated list', async () => {
    await request(app.getHttpServer()).get('/conversations').expect(401);
  });

  it('lists conversations for the authenticated user', async () => {
    conversations.listForClerkUser.mockResolvedValue({
      items: [
        {
          id: 'conv_1',
          title: 'Redis',
          createdAt: '2026-09-01T00:00:00.000Z',
          updatedAt: '2026-09-01T00:00:00.000Z',
          messageCount: 2,
        },
      ],
      nextCursor: null,
    });

    const res = await request(app.getHttpServer())
      .get('/conversations')
      .set('Authorization', 'Bearer valid-token')
      .expect(200);

    expect(res.body.data.items).toHaveLength(1);
    expect(conversations.listForClerkUser).toHaveBeenCalledWith(
      'clerk_user_a',
      expect.any(Object),
    );
  });

  it('blocks access to another user conversation', async () => {
    conversations.getForClerkUser.mockRejectedValue(
      new NotFoundException({
        error: {
          code: 'CONVERSATION_NOT_FOUND',
          message: 'Conversation not found.',
        },
      }),
    );

    await request(app.getHttpServer())
      .get('/conversations/conv_b')
      .set('Authorization', 'Bearer valid-token')
      .expect(404);
  });

  it('asks inside a conversation', async () => {
    ask.mockResolvedValue({
      question: 'What is Redis?',
      answer: 'Caching.',
      citations: [],
      insufficientEvidence: false,
      conversationId: 'conv_1',
      userMessageId: 'u1',
      assistantMessageId: 'a1',
    });

    const res = await request(app.getHttpServer())
      .post('/conversations/conv_1/ask')
      .set('Authorization', 'Bearer valid-token')
      .send({ question: 'What is Redis?' })
      .expect(200);

    expect(res.body.data.conversationId).toBe('conv_1');
    expect(ask).toHaveBeenCalledWith(
      'clerk_user_a',
      expect.objectContaining({
        conversationId: 'conv_1',
        question: 'What is Redis?',
      }),
    );
  });
});
