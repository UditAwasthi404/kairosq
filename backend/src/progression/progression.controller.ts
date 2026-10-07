import {
  Body,
  Controller,
  Get,
  HttpCode,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/auth-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import {
  ProgressionService,
  type LeaderboardView,
  type ProgressionView,
} from './progression.service';
import {
  parseBooleanFlag,
  parseCosmeticKey,
  parseDisplayName,
  parseLeaderboardScope,
  parsePeerId,
} from './progression.validation';

@Controller('progression')
@UseGuards(AuthGuard)
export class ProgressionController {
  constructor(private readonly progression: ProgressionService) {}

  @Get()
  async me(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: ProgressionView }> {
    return { data: await this.progression.getForClerkUser(user.id) };
  }

  @Get('leaderboard')
  async leaderboard(
    @CurrentUser() user: AuthenticatedUser,
    @Query('scope') scope?: string,
  ): Promise<{ data: LeaderboardView }> {
    return {
      data: await this.progression.leaderboardForClerkUser(
        user.id,
        parseLeaderboardScope(scope),
      ),
    };
  }

  @Patch()
  async patch(
    @CurrentUser() user: AuthenticatedUser,
    @Body()
    body: {
      leaderboardVisible?: unknown;
      displayName?: unknown;
      equippedTitle?: unknown;
      equippedAura?: unknown;
    },
  ): Promise<{ data: ProgressionView }> {
    return {
      data: await this.progression.patchForClerkUser(user.id, {
        leaderboardVisible: parseBooleanFlag(body.leaderboardVisible, 'leaderboardVisible'),
        displayName: parseDisplayName(body.displayName),
        equippedTitle: parseCosmeticKey(body.equippedTitle),
        equippedAura: parseCosmeticKey(body.equippedAura),
      }),
    };
  }

  @Post('freeze')
  @HttpCode(200)
  async buyFreeze(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: ProgressionView }> {
    return { data: await this.progression.buyFreeze(user.id) };
  }

  @Post('peers')
  @HttpCode(200)
  async addPeer(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: { peerUserId?: unknown },
  ): Promise<{ data: { ok: true } }> {
    await this.progression.addPeer(user.id, parsePeerId(body.peerUserId));
    return { data: { ok: true } };
  }
}
