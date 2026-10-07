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
import { SearchController } from './search.controller';
import { SearchService } from './search.service';

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

describe('SearchController', () => {
  let app: INestApplication<App>;
  const search = jest.fn();

  beforeEach(async () => {
    search.mockReset();
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [SearchController],
      providers: [{ provide: SearchService, useValue: { search } }],
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

  it('rejects unauthenticated search', async () => {
    await request(app.getHttpServer())
      .post('/search')
      .send({ query: 'redis' })
      .expect(401);
  });

  it('returns search results for authenticated users', async () => {
    search.mockResolvedValue({
      query: 'redis',
      total: 1,
      results: [
        {
          chunkId: 'c1',
          observationId: 'o1',
          chunkIndex: 0,
          content: 'Redis is fast',
          similarity: 0.9,
          observation: {
            id: 'o1',
            filename: 'redis.txt',
            type: 'TEXT',
            mimeType: 'text/plain',
            createdAt: '2026-09-01T00:00:00.000Z',
            capturedAt: '2026-09-01T00:00:00.000Z',
            summary: null,
          },
        },
      ],
    });

    const res = await request(app.getHttpServer())
      .post('/search')
      .set('Authorization', 'Bearer valid-token')
      .send({ query: 'redis', limit: 5 })
      .expect(200);

    expect(res.body.data.total).toBe(1);
    expect(search).toHaveBeenCalledWith('clerk_user_a', {
      query: 'redis',
      limit: 5,
    });
  });
});
