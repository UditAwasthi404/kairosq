import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit(): Promise<void> {
    if (process.env.SKIP_DB_CONNECT === 'true') {
      if (process.env.NODE_ENV === 'production') {
        throw new Error('SKIP_DB_CONNECT cannot be enabled in production.');
      }
      this.logger.warn('Skipping database connect (SKIP_DB_CONNECT=true)');
      return;
    }

    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL is required');
    }

    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
