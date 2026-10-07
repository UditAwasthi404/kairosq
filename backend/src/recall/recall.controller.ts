import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/auth-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { RecallService } from './recall.service';

@Controller('recall')
@UseGuards(AuthGuard)
export class RecallController {
  constructor(private readonly recall: RecallService) {}

  @Get('entitlement')
  async entitlement(@CurrentUser() user: AuthenticatedUser) {
    const data = await this.recall.getEntitlementForClerkUser(user.id);
    return { data };
  }

  @Post('events')
  @HttpCode(200)
  async ingestEvents(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: unknown,
  ) {
    const data = await this.recall.ingestEventsForClerkUser(user.id, body);
    return { data };
  }

  @Delete('data')
  @HttpCode(200)
  async deleteRecallData(@CurrentUser() user: AuthenticatedUser) {
    const data = await this.recall.deleteRecallDataForClerkUser(user.id);
    return { data };
  }
}
