import {
  CanActivate,
  ExecutionContext,
  INestApplication,
  UnauthorizedException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ObservationType, ProcessingStatus } from '@prisma/client';
import request from 'supertest';
import { App } from 'supertest/types';
import { AuthGuard } from '../auth/auth.guard';
import { ObservationsController } from './observations.controller';
import { ObservationsService } from './observations.service';

class TestAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<{
      headers: { authorization?: string };
      user?: { id: string; authenticated: true };
    }>();
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer valid-token')) {
      throw new UnauthorizedException();
    }
    req.user = { id: 'clerk_user_a', authenticated: true };
    return true;
  }
}

describe('ObservationsController', () => {
  let app: INestApplication<App>;
  const upload = jest.fn();
  const listForClerkUser = jest.fn();
  const getForClerkUser = jest.fn();
  const reprocessForClerkUser = jest.fn();
  const getDownloadUrlForClerkUser = jest.fn();
  const getFileForClerkUser = jest.fn();
  const relatedForClerkUser = jest.fn();
  const updateForClerkUser = jest.fn();

  beforeEach(async () => {
    upload.mockReset();
    listForClerkUser.mockReset();
    getForClerkUser.mockReset();
    reprocessForClerkUser.mockReset();
    getDownloadUrlForClerkUser.mockReset();
    getFileForClerkUser.mockReset();
    relatedForClerkUser.mockReset();
    updateForClerkUser.mockReset();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [ObservationsController],
      providers: [
        {
          provide: ObservationsService,
          useValue: {
            upload,
            listForClerkUser,
            getForClerkUser,
            reprocessForClerkUser,
            getDownloadUrlForClerkUser,
            getFileForClerkUser,
            relatedForClerkUser,
            updateForClerkUser,
          },
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

  it('rejects unauthenticated upload', async () => {
    await request(app.getHttpServer())
      .post('/observations/upload')
      .attach('file', Buffer.from('hello'), 'notes.txt')
      .expect(401);
  });

  it('accepts authenticated upload', async () => {
    const now = new Date().toISOString();
    upload.mockResolvedValue({
      id: 'obs_1',
      filename: 'notes.txt',
      mimeType: 'text/plain',
      type: ObservationType.TEXT,
      status: ProcessingStatus.PENDING,
      createdAt: now,
      updatedAt: now,
      capturedAt: now,
      extractedText: null,
      processingError: null,
      sourceMetadata: null,
    });

    const res = await request(app.getHttpServer())
      .post('/observations/upload')
      .set('Authorization', 'Bearer valid-token')
      .attach('file', Buffer.from('hello kairos'), {
        filename: 'notes.txt',
        contentType: 'text/plain',
      })
      .expect(201);

    expect(res.body).toMatchObject({
      data: { id: 'obs_1' },
    });
    expect(upload).toHaveBeenCalled();
  });

  it('returns observation processing status for authenticated owner', async () => {
    const now = new Date().toISOString();
    getForClerkUser.mockResolvedValue({
      id: 'obs_1',
      filename: 'notes.txt',
      mimeType: 'text/plain',
      type: ObservationType.TEXT,
      status: ProcessingStatus.EMBEDDING,
      stageLabel: 'Generating embeddings…',
      createdAt: now,
      updatedAt: now,
      capturedAt: now,
      processedAt: null,
      extractedText: null,
      summary: null,
      processingError: null,
      sourceMetadata: null,
      metadata: {
        filename: 'notes.txt',
        mimeType: 'text/plain',
        fileSizeBytes: 12,
        pageCount: null,
        characterCount: null,
        wordCount: null,
        chunkCount: null,
      },
      topics: [],
      entities: [],
      projects: [],
      chunkCount: 0,
    });

    const res = await request(app.getHttpServer())
      .get('/observations/obs_1')
      .set('Authorization', 'Bearer valid-token')
      .expect(200);

    expect(res.body.data).toMatchObject({
      id: 'obs_1',
      status: ProcessingStatus.EMBEDDING,
      stageLabel: 'Generating embeddings…',
    });
  });

  it('reprocesses via existing retry endpoint', async () => {
    const now = new Date().toISOString();
    reprocessForClerkUser.mockResolvedValue({
      id: 'obs_1',
      filename: 'notes.txt',
      mimeType: 'text/plain',
      type: ObservationType.TEXT,
      status: ProcessingStatus.PENDING,
      stageLabel: 'Processing…',
      createdAt: now,
      updatedAt: now,
      capturedAt: now,
      processedAt: null,
      extractedText: null,
      summary: null,
      processingError: null,
      sourceMetadata: null,
      metadata: {
        filename: 'notes.txt',
        mimeType: 'text/plain',
        fileSizeBytes: 12,
        pageCount: null,
        characterCount: null,
        wordCount: null,
        chunkCount: null,
      },
      topics: [],
      entities: [],
      projects: [],
      chunkCount: 0,
    });

    const res = await request(app.getHttpServer())
      .post('/observations/obs_1/reprocess')
      .set('Authorization', 'Bearer valid-token')
      .expect(201);

    expect(reprocessForClerkUser).toHaveBeenCalledWith('clerk_user_a', 'obs_1');
    expect(res.body.data.status).toBe(ProcessingStatus.PENDING);
  });

  it('rejects unauthenticated memory edits', async () => {
    await request(app.getHttpServer())
      .patch('/observations/obs_1')
      .send({ title: 'Edited' })
      .expect(401);
    expect(updateForClerkUser).not.toHaveBeenCalled();
  });

  it('saves an authenticated memory edit', async () => {
    updateForClerkUser.mockResolvedValue({
      id: 'obs_1',
      filename: 'Edited.txt',
      extractedText: 'New text',
    });
    const res = await request(app.getHttpServer())
      .patch('/observations/obs_1')
      .set('Authorization', 'Bearer valid-token')
      .send({ title: 'Edited', content: 'New text' })
      .expect(200);
    expect(updateForClerkUser).toHaveBeenCalledWith('clerk_user_a', 'obs_1', {
      title: 'Edited',
      content: 'New text',
    });
    expect(res.body.data.filename).toBe('Edited.txt');
  });
});
