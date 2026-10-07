import {
  Body,
  Controller,
  Delete,
  HttpCode,
  Put,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/auth-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { NotificationsService } from './notifications.service';

type PushTokenBody = {
  token?: unknown;
  platform?: unknown;
};

@Controller('devices')
@UseGuards(AuthGuard)
export class DevicesController {
  constructor(private readonly notifications: NotificationsService) {}

  @Put('push-token')
  async register(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: PushTokenBody,
  ): Promise<{ data: { id: string; platform: string } }> {
    const result = await this.notifications.registerToken({
      clerkUserId: user.id,
      token: body?.token,
      platform: body?.platform,
    });
    return { data: result };
  }

  @Delete('push-token')
  @HttpCode(200)
  async unregister(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: PushTokenBody,
  ): Promise<{ data: { removed: boolean } }> {
    const result = await this.notifications.unregisterToken({
      clerkUserId: user.id,
      token: body?.token,
    });
    return { data: result };
  }
}
