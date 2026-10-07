import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';

describe('Auth (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    process.env.SKIP_DB_CONNECT = 'true';
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('GET /auth/me without credentials returns 401', () => {
    return request(app.getHttpServer()).get('/auth/me').expect(401);
  });

  it('GET /auth/me with an invalid bearer token returns 401', () => {
    return request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', 'Bearer invalid-token')
      .expect(401);
  });
});
