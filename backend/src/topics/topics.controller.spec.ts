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
import { TopicsController } from './topics.controller';
import { TopicsService } from './topics.service';

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

describe('TopicsController', () => {
  let app: INestApplication<App>;
  const listForClerkUser = jest.fn();
  const getForClerkUser = jest.fn();

  beforeEach(async () => {
    listForClerkUser.mockReset();
    getForClerkUser.mockReset();
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [TopicsController],
      providers: [
        {
          provide: TopicsService,
          useValue: { listForClerkUser, getForClerkUser },
        },
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

  it('rejects unauthenticated topic listing', async () => {
    await request(app.getHttpServer()).get('/topics').expect(401);
  });

  it('lists topics for the authenticated user', async () => {
    listForClerkUser.mockResolvedValue({
      items: [
        {
          id: 't1',
          name: 'Redis',
          observationCount: 2,
          updatedAt: '2026-09-01T00:00:00.000Z',
        },
      ],
      nextCursor: null,
    });

    const res = await request(app.getHttpServer())
      .get('/topics')
      .set('Authorization', 'Bearer valid-token')
      .expect(200);

    expect(res.body.data.items[0].name).toBe('Redis');
    expect(listForClerkUser).toHaveBeenCalledWith(
      'clerk_user_a',
      expect.any(Object),
    );
  });
});
