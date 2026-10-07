import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { UsersModule } from '../users/users.module';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { EntitlementService } from './entitlement.service';
import { RevenueCatWebhookController } from './revenuecat-webhook.controller';

@Module({
  imports: [PrismaModule, UsersModule],
  controllers: [RevenueCatWebhookController, BillingController],
  providers: [EntitlementService, BillingService],
  exports: [EntitlementService],
})
export class EntitlementsModule {}
