import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { EntityType } from '@prisma/client';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/auth-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { EntitiesService } from './entities.service';

const ENTITY_TYPES = new Set(Object.values(EntityType));

@Controller('entities')
@UseGuards(AuthGuard)
export class EntitiesController {
  constructor(private readonly entities: EntitiesService) {}

  @Get()
  async list(
    @CurrentUser() user: AuthenticatedUser,
    @Query('limit') limitRaw?: string,
    @Query('cursor') cursor?: string,
    @Query('type') typeRaw?: string,
  ) {
    const limit = limitRaw ? Number.parseInt(limitRaw, 10) : undefined;
    const type =
      typeRaw && ENTITY_TYPES.has(typeRaw as EntityType)
        ? (typeRaw as EntityType)
        : undefined;
    const data = await this.entities.listForClerkUser(user.id, {
      limit: Number.isFinite(limit) ? limit : undefined,
      cursor: cursor || undefined,
      type,
    });
    return { data };
  }

  @Get(':id')
  async getOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    const data = await this.entities.getForClerkUser(user.id, id);
    return { data };
  }
}
