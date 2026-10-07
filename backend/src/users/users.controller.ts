import { Controller, Delete, HttpCode, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/auth-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { UsersService } from './users.service';

@Controller('users')
@UseGuards(AuthGuard)
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Delete('me/data')
  @HttpCode(200)
  async deleteMyData(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: { deletedObservations: number } }> {
    const result = await this.users.deleteAllDataForClerkUser(user.id);
    return { data: result };
  }
}
