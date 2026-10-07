import { EntitlementStatus } from '@prisma/client';

export type ProSnapshot = {
  isPro: boolean;
  status: EntitlementStatus;
  validUntil: Date | null;
  store: string;
  productId: string | null;
};

const STORE_BY_REVENUECAT: Record<string, string> = {
  app_store: 'app_store',
  mac_app_store: 'app_store',
  play_store: 'play_store',
  stripe: 'stripe',
  rc_billing: 'stripe',
  promotional: 'promotional',
  test_store: 'test_store',
  amazon: 'amazon',
};

export function mapRevenueCatStore(raw: unknown): string {
  if (typeof raw !== 'string') return 'unknown';
  return STORE_BY_REVENUECAT[raw.trim().toLowerCase()] ?? 'unknown';
}

function parseDate(raw: unknown): Date | null {
  if (typeof raw !== 'string' || !raw) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

type SubscriberEntitlement = {
  expires_date?: unknown;
  product_identifier?: unknown;
  grace_period_expires_date?: unknown;
};

type SubscriberSubscription = {
  expires_date?: unknown;
  store?: unknown;
  period_type?: unknown;
  billing_issues_detected_at?: unknown;
  grace_period_expires_date?: unknown;
};

/** RevenueCat GET /v1/subscribers payload → the Pro row we persist in Neon. */
export function snapshotFromSubscriber(
  body: unknown,
  now = new Date(),
): ProSnapshot {
  const subscriber = isRecord(body) ? asRecord(body.subscriber) : null;
  const entitlements = subscriber ? asRecord(subscriber.entitlements) : null;
  const recall = entitlements
    ? (asRecord(entitlements.recall) as SubscriberEntitlement | null)
    : null;
  const productId =
    recall && typeof recall.product_identifier === 'string'
      ? recall.product_identifier
      : null;
  const subscriptions = subscriber ? asRecord(subscriber.subscriptions) : null;
  const subscription = productId
    ? ((subscriptions
        ? asRecord(subscriptions[productId])
        : null) as SubscriberSubscription | null)
    : null;

  const store = mapRevenueCatStore(subscription?.store);
  const validUntil = parseDate(recall?.expires_date ?? subscription?.expires_date);
  const graceUntil = parseDate(
    subscription?.grace_period_expires_date ?? recall?.grace_period_expires_date,
  );
  const inactive: ProSnapshot = {
    isPro: false,
    status: EntitlementStatus.inactive,
    validUntil,
    store,
    productId,
  };
  if (!recall) return inactive;

  const inGrace =
    Boolean(subscription?.billing_issues_detected_at) &&
    graceUntil != null &&
    graceUntil.getTime() > now.getTime();
  if (inGrace) {
    return {
      isPro: true,
      status: EntitlementStatus.grace,
      validUntil: graceUntil,
      store,
      productId,
    };
  }
  if (validUntil && validUntil.getTime() <= now.getTime()) return inactive;
  if (subscription?.period_type === 'trial') {
    return {
      isPro: true,
      status: EntitlementStatus.trial,
      validUntil,
      store,
      productId,
    };
  }
  return {
    isPro: true,
    status: EntitlementStatus.active,
    validUntil,
    store,
    productId,
  };
}

export type WebhookDecision =
  | { action: 'ignore' }
  | {
      action: 'apply';
      status: EntitlementStatus;
      validUntil: Date | null;
      store: string;
      productId: string | null;
      eventAt: Date;
      source: 'revenuecat' | 'stripe';
    };

const GRANTING_EVENTS = new Set([
  'INITIAL_PURCHASE',
  'NON_RENEWING_PURCHASE',
  'RENEWAL',
  'PRODUCT_CHANGE',
  'UNCANCELLATION',
  'BILLING_ISSUE',
  'TEMPORARY_ENTITLEMENT_GRANT',
  'REFUND_REVERSED',
]);
const REVOKING_EVENTS = new Set(['EXPIRATION', 'SUBSCRIPTION_PAUSED', 'REFUND']);

export function decisionFromWebhookEvent(
  event: {
    type?: unknown;
    entitlement_ids?: unknown;
    expiration_at_ms?: unknown;
    event_timestamp_ms?: unknown;
    store?: unknown;
    product_id?: unknown;
  },
  now = Date.now(),
): WebhookDecision {
  if (
    typeof event.type !== 'string' ||
    !Array.isArray(event.entitlement_ids) ||
    !event.entitlement_ids.includes('recall')
  ) {
    return { action: 'ignore' };
  }
  if (
    !GRANTING_EVENTS.has(event.type) &&
    !REVOKING_EVENTS.has(event.type) &&
    event.type !== 'CANCELLATION'
  ) {
    return { action: 'ignore' };
  }

  const validUntil =
    typeof event.expiration_at_ms === 'number'
      ? new Date(event.expiration_at_ms)
      : null;
  const eventAt =
    typeof event.event_timestamp_ms === 'number'
      ? new Date(event.event_timestamp_ms)
      : new Date(now);
  const store = mapRevenueCatStore(event.store);
  const productId = typeof event.product_id === 'string' ? event.product_id : null;
  const canGrant = GRANTING_EVENTS.has(event.type) || event.type === 'CANCELLATION';
  const active = canGrant && (!validUntil || validUntil.getTime() > now);
  const status = active
    ? event.type === 'BILLING_ISSUE'
      ? EntitlementStatus.grace
      : EntitlementStatus.active
    : EntitlementStatus.inactive;

  return {
    action: 'apply',
    status,
    validUntil,
    store,
    productId,
    eventAt,
    source: store === 'stripe' ? 'stripe' : 'revenuecat',
  };
}

/** Identified RevenueCat Web Purchase Link. Stripe checkout is hosted by RevenueCat. */
export function revenueCatStripeCheckoutUrl(base: string, appUserId: string): string {
  const trimmed = base.trim();
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new Error('Stripe purchase URL is not a valid URL.');
  }
  if (url.protocol !== 'https:') {
    throw new Error('Stripe purchase URL must use https.');
  }
  const segment = encodeURIComponent(appUserId);
  url.pathname = `${url.pathname.replace(/\/+$/, '')}/${segment}`;
  url.searchParams.set('skip_purchase_success', 'true');
  return url.toString();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return isRecord(value) ? value : null;
}
