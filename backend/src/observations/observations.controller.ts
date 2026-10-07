import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Res,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { contentDispositionAttachment } from '../config/env';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { memoryStorage } from 'multer';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/auth-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { MAX_UPLOAD_BYTES } from './file-validation';
import type { ObservationResponse } from './observation.mapper';
import { ObservationsService } from './observations.service';

@Controller('observations')
@UseGuards(AuthGuard)
export class ObservationsController {
  constructor(private readonly observations: ObservationsService) {}

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_UPLOAD_BYTES },
    }),
  )
  async upload(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<{ data: ObservationResponse }> {
    const observation = await this.observations.upload({
      clerkUserId: user.id,
      file,
    });
    return { data: observation };
  }

  @Post('from-text')
  async fromText(
    @CurrentUser() user: AuthenticatedUser,
    @Body()
    body: {
      text?: string;
      title?: string;
      source?: string;
      capturedAt?: string;
    },
  ): Promise<{ data: ObservationResponse }> {
    const observation = await this.observations.capture({
      clerkUserId: user.id,
      content: body?.text ?? '',
      title: body?.title,
      source: body?.source,
      capturedAt: body?.capturedAt,
    });
    return { data: observation };
  }

  @Post('from-url')
  async fromUrl(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: { url?: string; source?: string; capturedAt?: string },
  ): Promise<{ data: ObservationResponse }> {
    const observation = await this.observations.capture({
      clerkUserId: user.id,
      url: body?.url ?? '',
      source: body?.source,
      capturedAt: body?.capturedAt,
    });
    return { data: observation };
  }

  @Get()
  async list(
    @CurrentUser() user: AuthenticatedUser,
    @Query('topicId') topicId?: string,
    @Query('entityId') entityId?: string,
    @Query('projectId') projectId?: string,
    @Query('topic') topic?: string,
    @Query('entity') entity?: string,
    @Query('source') source?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
  ): Promise<{ data: ObservationResponse[]; nextCursor: string | null }> {
    const parsedLimit = limit ? Number.parseInt(limit, 10) : undefined;
    const page = await this.observations.listForClerkUser(user.id, {
      topicId: topicId || undefined,
      entityId: entityId || undefined,
      projectId: projectId || undefined,
      topic: topic || undefined,
      entity: entity || undefined,
      source: source || undefined,
      from: from || undefined,
      to: to || undefined,
      limit: Number.isFinite(parsedLimit) ? parsedLimit : undefined,
      cursor: cursor || undefined,
    });
    return { data: page.items, nextCursor: page.nextCursor };
  }

  @Get(':id/related')
  async related(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return { data: await this.observations.relatedForClerkUser(user.id, id) };
  }

  @Get(':id')
  async getOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<{ data: ObservationResponse }> {
    const observation = await this.observations.getForClerkUser(user.id, id);
    return { data: observation };
  }

  @Get(':id/download-url')
  async downloadUrl(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    const result = await this.observations.getDownloadUrlForClerkUser(
      user.id,
      id,
    );
    return { data: result };
  }

  @Get(':id/file')
  @Header('Cache-Control', 'private, no-store')
  async file(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const file = await this.observations.getFileForClerkUser(user.id, id);
    res.set({
      'Content-Type': file.mimeType,
      'Content-Disposition': contentDispositionAttachment(file.filename),
    });
    return new StreamableFile(file.buffer);
  }

  @Patch(':id')
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: { title?: string; content?: string },
  ): Promise<{ data: ObservationResponse }> {
    return {
      data: await this.observations.updateForClerkUser(user.id, id, {
        title: body?.title,
        content: body?.content,
      }),
    };
  }

  @Post(':id/reprocess')
  async reprocess(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<{ data: ObservationResponse }> {
    const observation = await this.observations.reprocessForClerkUser(
      user.id,
      id,
    );
    return { data: observation };
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<void> {
    await this.observations.deleteForClerkUser(user.id, id);
  }
}
