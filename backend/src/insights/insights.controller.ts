import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/auth-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import {
  InsightsService,
  type DailyBrief,
  type DashboardSummary,
  type PredictionsSummary,
  type TodayInsight,
} from './insights.service';

@Controller('insights')
@UseGuards(AuthGuard)
export class InsightsController {
  constructor(private readonly insights: InsightsService) {}

  @Get('today')
  async today(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: TodayInsight }> {
    return { data: await this.insights.todayForClerkUser(user.id) };
  }

  @Get('dashboard')
  async dashboard(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: DashboardSummary }> {
    return { data: await this.insights.dashboardForClerkUser(user.id) };
  }

  @Get('predictions')
  async predictions(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: PredictionsSummary }> {
    return { data: await this.insights.predictionsForClerkUser(user.id) };
  }

  @Get('brief')
  async brief(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: DailyBrief }> {
    return { data: await this.insights.briefForClerkUser(user.id) };
  }
}
