import {
  Body,
  Controller,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/auth-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { MAX_UPLOAD_BYTES } from './file-validation';
import type { ObservationResponse } from './observation.mapper';
import { ObservationsService } from './observations.service';

type CaptureBody = {
  clientCaptureId?: string;
  content?: string;
  text?: string;
  source?: string;
  capturedAt?: string;
  url?: string;
  title?: string;
  metadata?: Record<string, unknown>;
  projectId?: string;
};

@Controller('capture')
@UseGuards(AuthGuard)
export class CaptureController {
  constructor(private readonly observations: ObservationsService) {}

  @Post()
  async capture(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CaptureBody,
  ): Promise<{ data: ObservationResponse }> {
    const observation = await this.captureIdempotently(user.id, body, () =>
      this.observations.capture({
        clerkUserId: user.id,
        clientCaptureId: body?.clientCaptureId,
        content: body?.content ?? body?.text,
        source: body?.source,
        capturedAt: body?.capturedAt,
        url: body?.url,
        title: body?.title,
        metadata: body?.metadata,
        projectId: body?.projectId,
      }),
    );
    return { data: observation };
  }

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_UPLOAD_BYTES },
    }),
  )
  async captureUpload(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: CaptureBody,
  ): Promise<{ data: ObservationResponse }> {
    let metadata = body?.metadata;
    if (typeof metadata === 'string') {
      try {
        metadata = JSON.parse(metadata) as Record<string, unknown>;
      } catch {
        metadata = undefined;
      }
    }
    const observation = await this.captureIdempotently(user.id, body, () =>
      this.observations.capture({
        clerkUserId: user.id,
        clientCaptureId: body?.clientCaptureId,
        file,
        content: body?.content ?? body?.text,
        source: body?.source,
        capturedAt: body?.capturedAt,
        url: body?.url,
        title: body?.title,
        metadata,
        projectId: body?.projectId,
      }),
    );
    return { data: observation };
  }

  private async captureIdempotently(
    clerkUserId: string,
    body: CaptureBody,
    operation: () => Promise<ObservationResponse>,
  ): Promise<ObservationResponse> {
    try {
      return await operation();
    } catch (error) {
      const clientCaptureId = body?.clientCaptureId?.trim();
      if (!clientCaptureId || (error as { code?: string })?.code !== 'P2002') {
        throw error;
      }
      const existing = await this.observations.findByClientCaptureId(
        clerkUserId,
        clientCaptureId,
      );
      if (!existing) throw error;
      return existing;
    }
  }
}
