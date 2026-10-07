import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/auth-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { ProjectsService } from './projects.service';
import type {
  AddObservationBody,
  BulkAddObservationsBody,
  CreateProjectBody,
  UpdateProjectBody,
} from './projects.validation';

@Controller('projects')
@UseGuards(AuthGuard)
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  @Get()
  async list(
    @CurrentUser() user: AuthenticatedUser,
    @Query('limit') limitRaw?: string,
    @Query('cursor') cursor?: string,
  ) {
    const limit = limitRaw ? Number.parseInt(limitRaw, 10) : undefined;
    const data = await this.projects.listForClerkUser(user.id, {
      limit: Number.isFinite(limit) ? limit : undefined,
      cursor: cursor || undefined,
    });
    return { data };
  }

  @Post()
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CreateProjectBody,
  ) {
    const data = await this.projects.createForClerkUser(user.id, body);
    return { data };
  }

  @Get(':id')
  async getOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Query('limit') limitRaw?: string,
    @Query('cursor') cursor?: string,
  ) {
    const limit = limitRaw ? Number.parseInt(limitRaw, 10) : undefined;
    const data = await this.projects.getForClerkUser(user.id, id, {
      limit: Number.isFinite(limit) ? limit : undefined,
      cursor: cursor || undefined,
    });
    return { data };
  }

  @Patch(':id')
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: UpdateProjectBody,
  ) {
    const data = await this.projects.updateForClerkUser(user.id, id, body);
    return { data };
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<void> {
    await this.projects.deleteForClerkUser(user.id, id);
  }

  @Post(':id/observations/bulk')
  async addObservationsBulk(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: BulkAddObservationsBody,
  ) {
    const data = await this.projects.addObservationsBulkForClerkUser(
      user.id,
      id,
      body,
    );
    return { data };
  }

  @Post(':id/observations')
  async addObservation(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: AddObservationBody,
  ) {
    const data = await this.projects.addObservationForClerkUser(
      user.id,
      id,
      body,
    );
    return { data };
  }

  @Delete(':id/observations/:observationId')
  @HttpCode(204)
  async removeObservation(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Param('observationId') observationId: string,
  ): Promise<void> {
    await this.projects.removeObservationForClerkUser(
      user.id,
      id,
      observationId,
    );
  }
}
