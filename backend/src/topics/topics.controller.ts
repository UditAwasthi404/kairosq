import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/auth-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { TopicsService } from './topics.service';

@Controller('topics')
@UseGuards(AuthGuard)
export class TopicsController {
  constructor(private readonly topics: TopicsService) {}

  @Get()
  async list(
    @CurrentUser() user: AuthenticatedUser,
    @Query('limit') limitRaw?: string,
    @Query('cursor') cursor?: string,
  ) {
    const limit = limitRaw ? Number.parseInt(limitRaw, 10) : undefined;
    const data = await this.topics.listForClerkUser(user.id, {
      limit: Number.isFinite(limit) ? limit : undefined,
      cursor: cursor || undefined,
    });
    return { data };
  }

  @Get(':id')
  async getOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    const data = await this.topics.getForClerkUser(user.id, id);
    return { data };
  }
}
