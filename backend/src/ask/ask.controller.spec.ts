import {
  CanActivate,
  ExecutionContext,
  INestApplication,
  UnauthorizedException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AuthGuard } from '../auth/auth.guard';
import { AskController } from './ask.controller';
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

describe('AskController', () => {
  let app: INestApplication<App>;
  const ask = jest.fn();

  beforeEach(async () => {
    ask.mockReset();
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [AskController],
      providers: [{ provide: AskService, useValue: { ask } }],
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

  it('rejects unauthenticated ask', async () => {
    await request(app.getHttpServer())
      .post('/ask')
      .send({ question: 'What is Redis?' })
      .expect(401);
  });

  it('returns grounded answers for authenticated users', async () => {
    ask.mockResolvedValue({
      question: 'What is Redis?',
      answer: 'You learned that Redis is used for caching.',
      citations: [
        {
          observationId: 'obs_1',
          chunkId: 'chunk_1',
          title: 'redis.txt',
          snippet: 'Redis is used for caching.',
          createdAt: '2026-09-01T00:00:00.000Z',
        },
      ],
      insufficientEvidence: false,
      conversationId: 'conv_1',
      userMessageId: 'u1',
      assistantMessageId: 'a1',
    });

    const res = await request(app.getHttpServer())
      .post('/ask')
      .set('Authorization', 'Bearer valid-token')
      .send({ question: 'What is Redis?', limit: 4 })
      .expect(200);

    expect(res.body.data.answer).toContain('Redis');
    expect(res.body.data.citations).toHaveLength(1);
    expect(ask).toHaveBeenCalledWith('clerk_user_a', {
      question: 'What is Redis?',
      limit: 4,
    });
  });
});
