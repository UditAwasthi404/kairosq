import { Feather } from '@expo/vector-icons';
import { useState, type ComponentProps } from 'react';
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import type { PurchasesPackage } from 'react-native-purchases';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from './ThemedText';
import { ThemedButton } from './ui/ThemedButton';
import { ScreenGradient } from './ui/Glass';
import { useAppTheme } from '../providers/ThemeProvider';
import { useSubscription } from '../providers/SubscriptionProvider';

const FEATURES: {
  icon: ComponentProps<typeof Feather>['name'];
  title: string;
  body: string;
}[] = [
  {
    icon: 'eye',
    title: 'Screen memory',
    body: 'Keep the pages you were on, without writing a note.',
  },
  {
    icon: 'search',
    title: 'Find it later',
    body: 'Search a sentence, a site, or a decision from weeks ago.',
  },
  {
    icon: 'refresh-cw',
    title: 'On every device',
    body: 'Pro is saved to your account. Restore it anytime.',
  },
];

const PLAN_NAMES: Record<string, string> = {
  MONTHLY: 'Monthly',
  ANNUAL: 'Yearly',
  WEEKLY: 'Weekly',
  LIFETIME: 'Lifetime',
  SIX_MONTH: '6 months',
  THREE_MONTH: '3 months',
  TWO_MONTH: '2 months',
};

function billingPeriod(period: string | null): string {
  if (!period) return 'Subscription';
  const match = /^P(\d+)?(D|W|M|Y)$/.exec(period);
  if (!match) return 'Subscription';
  const count = Number(match[1] ?? 1);
  const unit = { D: 'day', W: 'week', M: 'month', Y: 'year' }[
    match[2] as 'D' | 'W' | 'M' | 'Y'
  ];
  return `Billed every ${count > 1 ? `${count} ` : ''}${unit}${count > 1 ? 's' : ''}`;
}

function planName(pkg: PurchasesPackage): string {
  return PLAN_NAMES[String(pkg.packageType)] ?? 'Kairos Pro';
}

export function RecallPaywall({
  onClose,
  onUnlocked,
}: {
  onClose: () => void;
  onUnlocked: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { colors, isLight, typography, spacing, radius } = useAppTheme();
  const { offering, error, purchase, purchaseWithCard, restorePurchases, refresh } =
    useSubscription();
  const [busy, setBusy] = useState(false);
  const [chosenId, setChosenId] = useState<string | null>(null);
  const packages = offering?.availablePackages ?? [];
  const selected =
    packages.find((pkg) => pkg.identifier === chosenId) ?? packages[0] ?? null;

  const finish = async (outcome: 'active' | 'inactive' | 'cancelled' | 'store_unavailable' | 'error') => {
    if (outcome === 'active') {
      await refresh();
      onUnlocked();
      return;
    }
    if (outcome === 'inactive') {
      Alert.alert(
        'Kairos Pro',
        'The Recall entitlement is not active yet. Please try again shortly.',
      );
    }
  };

  const buy = async () => {
    if (busy) return;
    setBusy(true);
    if (selected) {
      const outcome = await purchase(selected);
      if (outcome !== 'store_unavailable') {
        await finish(outcome);
        setBusy(false);
        return;
      }
    }
    await finish(await purchaseWithCard());
    setBusy(false);
  };

  const restore = async () => {
    if (busy) return;
    setBusy(true);
    const outcome = await restorePurchases();
    if (outcome === 'active') {
      await refresh();
      onUnlocked();
    } else if (outcome === 'inactive') {
      Alert.alert(
        'No purchases found',
        'There is no active Kairos Pro subscription to restore.',
      );
    }
    setBusy(false);
  };

  return (
    <ScreenGradient>
      <View style={[styles.page, { paddingTop: insets.top + 8 }]}>
        <View style={styles.header}>
          <Image
            source={
              isLight
                ? require('../assets/logo-dark.png')
                : require('../assets/logo-light.png')
            }
            style={styles.logo}
            accessibilityIgnoresInvertColors
          />
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Close paywall"
            hitSlop={8}
            style={[
              styles.close,
              {
                backgroundColor: colors.surfaceElevated,
                borderColor: colors.border,
                borderRadius: radius.full,
              },
            ]}
          >
            <Feather name="x" size={18} color={colors.textSecondary} />
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: spacing['6'] }]}
          showsVerticalScrollIndicator={false}
        >
          <ThemedText colorKey="accent" style={styles.kicker}>
            KAIROS PRO
          </ThemedText>
          <ThemedText
            colorKey="text"
            style={[
              styles.headline,
              {
                fontFamily: typography.display.fontFamily,
                fontSize: typography.display.size,
                lineHeight: typography.display.lineHeight,
              },
            ]}
          >
            The work you{'\n'}already did.
          </ThemedText>
          <ThemedText colorKey="textSecondary" style={styles.sub}>
            Recall stays on with Kairos Pro. A page or a moment is still there when you come back.
          </ThemedText>

          <View
            style={[
              styles.panel,
              {
                backgroundColor: colors.surfaceElevated,
                borderColor: colors.border,
                borderRadius: radius.xl,
              },
            ]}
          >
            {FEATURES.map((feature, index) => (
              <View
                key={feature.title}
                style={[
                  styles.feature,
                  index > 0 && {
                    borderTopWidth: StyleSheet.hairlineWidth,
                    borderTopColor: colors.divider,
                  },
                ]}
              >
                <View style={[styles.iconWell, { backgroundColor: colors.accentGlow }]}>
                  <Feather name={feature.icon} size={16} color={colors.accent} />
                </View>
                <View style={styles.featureCopy}>
                  <ThemedText colorKey="text" style={styles.featureTitle}>
                    {feature.title}
                  </ThemedText>
                  <ThemedText colorKey="textSecondary" style={styles.featureBody}>
                    {feature.body}
                  </ThemedText>
                </View>
              </View>
            ))}
          </View>

          {packages.length > 1 ? (
            <View style={styles.plans}>
              {packages.map((pkg) => {
                const active = pkg.identifier === selected?.identifier;
                return (
                  <Pressable
                    key={pkg.identifier}
                    onPress={() => setChosenId(pkg.identifier)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    accessibilityLabel={`${planName(pkg)}, ${pkg.product.priceString}`}
                    style={[
                      styles.plan,
                      {
                        backgroundColor: active ? colors.accentGlow : colors.surfaceElevated,
                        borderColor: active ? colors.accent : colors.border,
                        borderRadius: radius.lg,
                      },
                    ]}
                  >
                    <View style={styles.planCopy}>
                      <ThemedText colorKey="text" style={styles.planName}>
                        {planName(pkg)}
                      </ThemedText>
                      <ThemedText colorKey="textMuted" style={styles.planPeriod}>
                        {billingPeriod(pkg.product.subscriptionPeriod)}
                      </ThemedText>
                    </View>
                    <ThemedText colorKey="text" style={styles.planPrice}>
                      {pkg.product.priceString}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </View>
          ) : (
            <View
              style={[
                styles.heroPlan,
                {
                  backgroundColor: colors.surfaceElevated,
                  borderColor: colors.accent,
                  borderRadius: radius.xl,
                },
              ]}
            >
              <View style={[styles.accentBar, { backgroundColor: colors.accent }]} />
              <View style={styles.heroBody}>
                <View style={styles.heroTop}>
                  <ThemedText colorKey="text" style={styles.planName}>
                    {selected ? planName(selected) : 'Kairos Pro'}
                  </ThemedText>
                  <View style={[styles.badge, { backgroundColor: colors.accentGlow }]}>
                    <ThemedText colorKey="accent" style={styles.badgeText}>
                      RECALL
                    </ThemedText>
                  </View>
                </View>
                <ThemedText
                  colorKey="text"
                  style={[
                    styles.price,
                    {
                      fontFamily: typography.hero.fontFamily,
                      fontSize: 44,
                      lineHeight: 52,
                    },
                  ]}
                >
                  {selected ? selected.product.priceString : 'Card'}
                </ThemedText>
                <ThemedText colorKey="textMuted" style={styles.planPeriod}>
                  {selected
                    ? billingPeriod(selected.product.subscriptionPeriod)
                    : 'Billed through Stripe when the store is unavailable'}
                </ThemedText>
              </View>
            </View>
          )}

          {error ? (
            <ThemedText colorKey="warning" style={styles.error}>
              {error}
            </ThemedText>
          ) : null}
        </ScrollView>

        <View
          style={[
            styles.footer,
            {
              paddingBottom: Math.max(insets.bottom, 16),
              borderTopColor: colors.border,
              backgroundColor: colors.background,
            },
          ]}
        >
          <ThemedButton
            label={selected ? 'Start Kairos Pro' : 'Continue with card'}
            onPress={() => void buy()}
            loading={busy}
            size="lg"
          />
          <ThemedButton
            label="Restore Purchases"
            variant="text"
            onPress={() => void restore()}
            disabled={busy}
          />
          <ThemedText colorKey="textMuted" style={styles.note}>
            {selected
              ? 'Billed by the App Store or Google Play. Cancel anytime. Pro is saved to your Kairos account.'
              : 'App Store and Google Play are not available here. Continue with card, billed through Stripe.'}
          </ThemedText>
        </View>
      </View>
    </ScreenGradient>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  logo: { width: 36, height: 36 },
  close: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 12,
    gap: 16,
  },
  kicker: {
    fontFamily: 'Roboto_500Medium',
    fontSize: 12,
    letterSpacing: 2.2,
  },
  headline: {
    marginTop: -4,
  },
  sub: {
    fontFamily: 'Roboto_400Regular',
    fontSize: 16,
    lineHeight: 24,
    marginTop: -4,
  },
  panel: {
    borderWidth: 1,
    overflow: 'hidden',
    marginTop: 4,
  },
  feature: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  iconWell: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureCopy: { flex: 1, gap: 2 },
  featureTitle: { fontFamily: 'Roboto_500Medium', fontSize: 16, lineHeight: 22 },
  featureBody: { fontFamily: 'Roboto_400Regular', fontSize: 14, lineHeight: 20 },
  plans: { gap: 10 },
  plan: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    borderWidth: 1.5,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  planCopy: { flex: 1, gap: 2 },
  planName: { fontFamily: 'Roboto_500Medium', fontSize: 16 },
  planPeriod: { fontFamily: 'Roboto_400Regular', fontSize: 13, lineHeight: 18 },
  planPrice: { fontFamily: 'Roboto_500Medium', fontSize: 18 },
  heroPlan: {
    borderWidth: 1.5,
    overflow: 'hidden',
  },
  accentBar: { height: 3, width: '100%' },
  heroBody: { paddingHorizontal: 18, paddingTop: 16, paddingBottom: 18, gap: 6 },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  badge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeText: {
    fontFamily: 'Roboto_500Medium',
    fontSize: 11,
    letterSpacing: 1.4,
  },
  price: { marginTop: 4 },
  error: { textAlign: 'center', fontSize: 13 },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    gap: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  note: {
    textAlign: 'center',
    fontFamily: 'Roboto_400Regular',
    fontSize: 11,
    lineHeight: 16,
    paddingHorizontal: 8,
  },
});
