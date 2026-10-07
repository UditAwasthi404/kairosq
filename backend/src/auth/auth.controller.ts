import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthGuard } from './auth.guard';
import { CurrentUser } from './auth-user.decorator';
import type { AuthenticatedUser } from './interfaces/authenticated-user.interface';

@Controller('auth')
export class AuthController {
  @Get('me')
  @UseGuards(AuthGuard)
  getMe(@CurrentUser() user: AuthenticatedUser): AuthenticatedUser {
    return user;
  }
}
