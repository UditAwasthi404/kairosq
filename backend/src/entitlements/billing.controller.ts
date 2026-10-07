import { Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/auth-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { BillingService } from './billing.service';

@Controller('billing')
@UseGuards(AuthGuard)
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  @Post('sync')
  @HttpCode(200)
  async sync(@CurrentUser() user: AuthenticatedUser) {
    return { data: await this.billing.syncClerkUser(user.id) };
  }

  @Post('checkout')
  @HttpCode(200)
  async checkout(@CurrentUser() user: AuthenticatedUser) {
    return { data: await this.billing.checkoutForClerkUser(user.id) };
  }
}
