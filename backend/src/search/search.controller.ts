import {
  Body,
  Controller,
  HttpCode,
  HttpException,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/auth-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { SearchService } from './search.service';
import type { SearchRequestBody } from './search.validation';

@Controller('search')
@UseGuards(AuthGuard)
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Post()
  @HttpCode(200)
  async search(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: SearchRequestBody,
  ) {
    try {
      const data = await this.searchService.search(user.id, body ?? {});
      return { data };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      const message = error instanceof Error ? error.message : 'Search failed';
      if (/not configured/i.test(message)) {
        throw new HttpException(
          {
            error: {
              code: 'SEARCH_UNAVAILABLE',
              message: 'Semantic search is temporarily unavailable.',
            },
          },
          HttpStatus.SERVICE_UNAVAILABLE,
        );
      }
      throw new HttpException(
        {
          error: {
            code: 'SEARCH_FAILED',
            message: 'Could not search your memories. Try again.',
          },
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
