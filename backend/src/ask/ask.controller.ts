import {
  Body,
  Controller,
  HttpCode,
  HttpException,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/auth-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { toAskHttpException } from './ask-errors';
import { AskService } from './ask.service';
import type { AskRequestBody } from './ask.validation';

@Controller('ask')
@UseGuards(AuthGuard)
export class AskController {
  constructor(private readonly askService: AskService) {}

  @Post()
  @HttpCode(200)
  async ask(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: AskRequestBody,
  ) {
    try {
      const data = await this.askService.ask(user.id, body ?? {});
      return { data };
    } catch (error) {
      throw toAskHttpException(error);
    }
  }
}
