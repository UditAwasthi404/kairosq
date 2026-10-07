import { Injectable } from '@nestjs/common';
import {
  EntitlementFeature,
  EntitlementStatus,
  type Entitlement,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  isEntitlementStatusAllowed,
  type EntitlementView,
} from './entitlement.types';
import {
  readStubDefaultStatus,
  readStubGrantAll,
  StubEntitlementProvider,
} from './stub-entitlement.provider';

@Injectable()
export class EntitlementService {
  private readonly provider = new StubEntitlementProvider();

  constructor(private readonly prisma: PrismaService) {}

  async isAllowed(
    userId: string,
    feature: EntitlementFeature = EntitlementFeature.RECALL,
  ): Promise<boolean> {
    const view = await this.getEntitlement(userId, feature);
    return view.allowed;
  }

  async getEntitlement(
    userId: string,
    feature: EntitlementFeature = EntitlementFeature.RECALL,
  ): Promise<EntitlementView> {
    if (!isRecallFeatureEnabled()) {
      return denied('disabled');
    }

    const remote = await this.provider.resolveRemote?.(userId, feature);
    if (remote) {
      await this.prisma.entitlement.upsert({
        where: { userId_feature: { userId, feature } },
        create: {
          userId,
          feature,
          status: remote.status,
          validUntil: remote.validUntil,
          isPro: isEntitlementStatusAllowed(remote.status, remote.validUntil),
          source: remote.source,
        },
        update: {
          status: remote.status,
          validUntil: remote.validUntil,
          isPro: isEntitlementStatusAllowed(remote.status, remote.validUntil),
          source: remote.source,
        },
      });
    }

    const row = await this.prisma.entitlement.findUnique({
      where: { userId_feature: { userId, feature } },
    });

    if (row) {
      return toView(row);
    }

    if (readStubGrantAll()) {
      return {
        feature: 'RECALL',
        status: EntitlementStatus.active,
        allowed: true,
        isPro: true,
        validUntil: null,
        source: 'stub_grant_all',
        store: null,
      };
    }

    const stubDefault = readStubDefaultStatus();
    if (stubDefault) {
      const allowed = isEntitlementStatusAllowed(stubDefault, null);
      return {
        feature: 'RECALL',
        status: stubDefault,
        allowed,
        isPro: allowed,
        validUntil: null,
        source: 'stub_default',
        store: null,
      };
    }

    return denied('none');
  }

  /**
   * Writes the Neon Pro row. A snapshot older than `lastEventAt` is dropped so a
   * late webhook cannot undo a newer store or Stripe update.
   */
  async recordBillingSnapshot(params: {
    userId: string;
    status: EntitlementStatus;
    validUntil: Date | null;
    source: string;
    store: string | null;
    productId: string | null;
    eventAt: Date;
    feature?: EntitlementFeature;
  }): Promise<'applied' | 'stale'> {
    const feature = params.feature ?? EntitlementFeature.RECALL;
    const existing = await this.prisma.entitlement.findUnique({
      where: { userId_feature: { userId: params.userId, feature } },
      select: { lastEventAt: true },
    });
    if (
      existing?.lastEventAt &&
      existing.lastEventAt.getTime() > params.eventAt.getTime()
    ) {
      return 'stale';
    }

    const isPro = isEntitlementStatusAllowed(params.status, params.validUntil);
    await this.prisma.entitlement.upsert({
      where: { userId_feature: { userId: params.userId, feature } },
      create: {
        userId: params.userId,
        feature,
        status: params.status,
        validUntil: params.validUntil,
        isPro,
        source: params.source,
        store: params.store,
        productId: params.productId,
        lastEventAt: params.eventAt,
      },
      update: {
        status: params.status,
        validUntil: params.validUntil,
        isPro,
        source: params.source,
        store: params.store,
        productId: params.productId,
        lastEventAt: params.eventAt,
      },
    });
    return 'applied';
  }

  /** Test/admin helper — upserts a DB entitlement row. */
  async upsertForUser(params: {
    userId: string;
    feature?: EntitlementFeature;
    status: EntitlementStatus;
    validUntil?: Date | null;
    source?: string;
  }): Promise<Entitlement> {
    const feature = params.feature ?? EntitlementFeature.RECALL;
    const validUntil = params.validUntil ?? null;
    const isPro = isEntitlementStatusAllowed(params.status, validUntil);
    return this.prisma.entitlement.upsert({
      where: { userId_feature: { userId: params.userId, feature } },
      create: {
        userId: params.userId,
        feature,
        status: params.status,
        validUntil,
        isPro,
        source: params.source ?? 'admin',
        lastEventAt: new Date(),
      },
      update: {
        status: params.status,
        validUntil,
        isPro,
        source: params.source ?? 'admin',
        lastEventAt: new Date(),
      },
    });
  }
}

function denied(source: string): EntitlementView {
  return {
    feature: 'RECALL',
    status: EntitlementStatus.inactive,
    allowed: false,
    isPro: false,
    validUntil: null,
    source,
    store: null,
  };
}

function toView(row: Entitlement): EntitlementView {
  const allowed = isEntitlementStatusAllowed(row.status, row.validUntil);
  return {
    feature: 'RECALL',
    status: allowed ? row.status : EntitlementStatus.expired,
    allowed,
    isPro: allowed,
    validUntil: row.validUntil ? row.validUntil.toISOString() : null,
    source: row.source,
    store: row.store,
  };
}

export function isRecallFeatureEnabled(): boolean {
  const raw = (process.env.RECALL_ENABLED ?? 'true').trim().toLowerCase();
  return raw !== '0' && raw !== 'false' && raw !== 'no';
}
