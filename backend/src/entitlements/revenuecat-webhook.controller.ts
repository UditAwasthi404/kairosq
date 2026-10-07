import {
  Controller,
  ForbiddenException,
  Headers,
  HttpCode,
  Post,
  Body,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EntitlementService } from './entitlement.service';
import { decisionFromWebhookEvent } from './revenuecat-access';

type RevenueCatEvent = {
  app_user_id?: unknown;
  type?: unknown;
  entitlement_ids?: unknown;
  expiration_at_ms?: unknown;
  event_timestamp_ms?: unknown;
  store?: unknown;
  product_id?: unknown;
};

@Controller('webhooks/revenuecat')
export class RevenueCatWebhookController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly entitlements: EntitlementService,
  ) {}

  @Post()
  @HttpCode(200)
  async receive(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: { event?: RevenueCatEvent },
  ) {
    const expected = process.env.REVENUECAT_WEBHOOK_AUTHORIZATION;
    if (!expected || authorization !== expected) throw new ForbiddenException();

    const event = body?.event;
    if (!event || typeof event.app_user_id !== 'string') {
      return { received: true, updated: false };
    }

    const decision = decisionFromWebhookEvent(event);
    if (decision.action === 'ignore') return { received: true, updated: false };

    const user = await this.prisma.user.findUnique({
      where: { clerkUserId: event.app_user_id },
      select: { id: true },
    });
    if (!user) return { received: true, updated: false };

    const result = await this.entitlements.recordBillingSnapshot({
      userId: user.id,
      status: decision.status,
      validUntil: decision.validUntil,
      source: decision.source,
      store: decision.store,
      productId: decision.productId,
      eventAt: decision.eventAt,
    });
    return { received: true, updated: result === 'applied' };
  }
}
