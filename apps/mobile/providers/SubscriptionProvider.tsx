import Purchases, {
  type PurchasesOffering,
  type PurchasesPackage,
} from 'react-native-purchases';
import { useAuth } from '@clerk/expo';
import * as WebBrowser from 'expo-web-browser';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AppState, Platform } from 'react-native';
import {
  getCustomerInfoAfterAction,
  hasRecallEntitlement,
} from '../lib/revenuecatEntitlements';
import { selectRevenueCatApiKey } from '../lib/revenuecatApiKey';
import { ApiError, createStripeCheckout, fetchRecallEntitlement, syncBilling } from '../lib/api';

const STORE_UNAVAILABLE = new Set([
  'STORE_PROBLEM_ERROR',
  'PURCHASE_NOT_ALLOWED_ERROR',
  'PRODUCT_NOT_AVAILABLE_FOR_PURCHASE_ERROR',
  'CONFIGURATION_ERROR',
  '2',
  '3',
  '5',
]);

type SubscriptionContextValue = {
  isLoading: boolean;
  hasRecallAccess: boolean;
  isPro: boolean;
  offering: PurchasesOffering | null;
  error: string | null;
  purchase: (
    aPackage: PurchasesPackage,
  ) => Promise<'active' | 'inactive' | 'cancelled' | 'store_unavailable' | 'error'>;
  purchaseWithCard: () => Promise<'active' | 'inactive' | 'cancelled' | 'error'>;
  restorePurchases: () => Promise<'active' | 'inactive' | 'error'>;
  refresh: () => Promise<void>;
  manageSubscriptions: () => Promise<void>;
};

const SubscriptionContext = createContext<SubscriptionContextValue | null>(
  null,
);
const API_KEY = selectRevenueCatApiKey({
  isDevelopment: __DEV__,
  platform:
    Platform.OS === 'ios' || Platform.OS === 'android' ? Platform.OS : 'web',
  testStoreKey: process.env.EXPO_PUBLIC_REVENUECAT_TEST_API_KEY,
  iosApiKey: process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY,
  androidApiKey: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY,
});

export function SubscriptionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isLoaded, isSignedIn, userId, getToken } = useAuth();
  const [serverPro, setServerPro] = useState(false);
  const [offering, setOffering] = useState<PurchasesOffering | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [serverChecked, setServerChecked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isConfigured, setIsConfigured] = useState(false);
  const identityQueue = useRef<Promise<void>>(Promise.resolve());
  const currentUser = useRef<string | null>(null);
  const desiredUser = useRef<string | null>(null);
  const configured = useRef(false);

  const applyServerView = useCallback(
    (view: { isPro?: boolean; allowed: boolean }, requestedUser: string) => {
      if (desiredUser.current !== requestedUser) return false;
      const pro = view.isPro ?? view.allowed;
      setServerPro(pro);
      setServerChecked(true);
      return pro;
    },
    [],
  );

  const readServer = useCallback(async () => {
    const requestedUser = userId;
    if (!requestedUser) {
      setServerPro(false);
      setServerChecked(true);
      return false;
    }
    try {
      const token = await getToken();
      if (!token || desiredUser.current !== requestedUser) return false;
      return applyServerView(await fetchRecallEntitlement(token), requestedUser);
    } catch {
      if (desiredUser.current === requestedUser) setServerChecked(true);
      return false;
    }
  }, [applyServerView, getToken, userId]);

  const syncServer = useCallback(async () => {
    const requestedUser = userId;
    if (!requestedUser) return false;
    try {
      const token = await getToken();
      if (!token || desiredUser.current !== requestedUser) return false;
      return applyServerView(await syncBilling(token), requestedUser);
    } catch {
      if (desiredUser.current === requestedUser) setServerChecked(true);
      return false;
    }
  }, [applyServerView, getToken, userId]);

  const refresh = useCallback(async () => {
    const requestedUser = userId;
    if (!configured.current || !requestedUser) return;
    try {
      const offerings = await Purchases.getOfferings();
      if (
        desiredUser.current !== requestedUser ||
        currentUser.current !== requestedUser
      )
        return;
      setOffering(offerings.current ?? null);
      setError(
        offerings.current
          ? null
          : 'Kairos Pro is temporarily unavailable. Please try again later.',
      );
    } catch {
      setError(
        'Could not load your subscription. Check your connection and try again.',
      );
    }
  }, [userId]);

  useEffect(() => {
    if (!isLoaded) return;
    desiredUser.current = userId ?? null;
    setServerPro(false);
    setServerChecked(false);
    setOffering(null);
    setIsLoading(Boolean(isSignedIn));
    setError(null);

    identityQueue.current = identityQueue.current
      .then(async () => {
        if (desiredUser.current !== userId) return;
        if (!userId) {
          if (configured.current) {
            try {
              await Purchases.logOut();
            } catch {
              /* SDK may already be anonymous. */
            }
          }
          if (desiredUser.current !== userId) return;
          currentUser.current = null;
          setServerPro(false);
          setServerChecked(true);
          setOffering(null);
          setIsLoading(false);
          return;
        }

        if (!API_KEY || Platform.OS === 'web') {
          setError(
            Platform.OS === 'web'
              ? 'Subscriptions are available in the Kairos mobile app.'
              : __DEV__
                ? 'Add the RevenueCat Test Store key to the mobile environment to enable subscriptions.'
                : 'Subscriptions are not configured for this platform.',
          );
          setIsLoading(false);
          return;
        }

        try {
          if (!configured.current) {
            Purchases.configure({ apiKey: API_KEY, appUserID: userId });
            configured.current = true;
            setIsConfigured(true);
          } else if (currentUser.current !== userId) {
            await Purchases.logIn(userId);
          }
          currentUser.current = userId;
          const offerings = await Purchases.getOfferings();
          if (desiredUser.current !== userId) return;
          setOffering(offerings.current ?? null);
          if (!offerings.current)
            setError(
              'Kairos Pro is temporarily unavailable. Please try again later.',
            );
        } catch {
          if (desiredUser.current === userId) {
            setError(
              'Could not connect to subscriptions. Check your connection and try again.',
            );
          }
        } finally {
          if (desiredUser.current === userId) setIsLoading(false);
        }
      })
      .catch(() => {
        if (desiredUser.current === userId) setIsLoading(false);
      });
  }, [isLoaded, isSignedIn, userId]);

  useEffect(() => {
    if (!isSignedIn || !userId) return;
    void readServer();
  }, [isSignedIn, readServer, userId]);

  useEffect(() => {
    if (!isConfigured) return;
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void refresh();
        void readServer();
      }
    });
    return () => {
      appState.remove();
    };
  }, [isConfigured, readServer, refresh]);

  const purchase = useCallback(
    async (aPackage: PurchasesPackage) => {
      setError(null);
      try {
        const info = await getCustomerInfoAfterAction(
          () => Purchases.purchasePackage(aPackage),
          () => Purchases.getCustomerInfo(),
        );
        if (desiredUser.current !== userId || currentUser.current !== userId)
          return 'error';
        if (!hasRecallEntitlement(info)) return 'inactive';
        return (await syncServer()) ? 'active' : 'inactive';
      } catch (cause) {
        const code = (cause as { userCancelled?: boolean; code?: string }).code;
        if (
          code === 'PURCHASE_CANCELLED_ERROR' ||
          code === '1' ||
          (cause as { userCancelled?: boolean }).userCancelled
        )
          return 'cancelled';
        if (code && STORE_UNAVAILABLE.has(code)) return 'store_unavailable';
        setError('Your purchase could not be completed. Please try again.');
        return 'error';
      }
    },
    [syncServer, userId],
  );

  const purchaseWithCard = useCallback(async () => {
    setError(null);
    try {
      const token = await getToken();
      if (!token || desiredUser.current !== userId) return 'error';
      const checkout = await createStripeCheckout(token);
      const session = await WebBrowser.openAuthSessionAsync(checkout.url, 'kairos://billing');
      const pro = await syncServer();
      if (configured.current) await refresh();
      if (pro) return 'active';
      if (session.type === 'cancel' || session.type === 'dismiss') return 'cancelled';
      return 'inactive';
    } catch (cause) {
      setError(
        cause instanceof ApiError
          ? cause.message
          : 'Card checkout could not be opened. Please try again.',
      );
      return 'error';
    }
  }, [getToken, refresh, syncServer, userId]);

  const restorePurchases = useCallback(async () => {
    setError(null);
    try {
      await Purchases.restorePurchases();
      if (desiredUser.current !== userId || currentUser.current !== userId)
        return 'error';
      return (await syncServer()) ? 'active' : 'inactive';
    } catch {
      setError(
        'Purchases could not be restored. Check your connection and try again.',
      );
      return 'error';
    }
  }, [syncServer, userId]);

  const manageSubscriptions = useCallback(async () => {
    try {
      await Purchases.showManageSubscriptions();
      await refresh();
    } catch {
      setError('Subscription settings could not be opened. Please try again.');
    }
  }, [refresh]);

  const hasRecallAccess = serverPro;
  const value = useMemo(
    () => ({
      isLoading: !isLoaded || isLoading || (Boolean(isSignedIn) && !serverChecked),
      hasRecallAccess,
      isPro: hasRecallAccess,
      offering,
      error,
      purchase,
      purchaseWithCard,
      restorePurchases,
      refresh,
      manageSubscriptions,
    }),
    [
      error,
      hasRecallAccess,
      isLoaded,
      isLoading,
      isSignedIn,
      serverChecked,
      manageSubscriptions,
      offering,
      purchase,
      purchaseWithCard,
      refresh,
      restorePurchases,
    ],
  );

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscription() {
  const context = useContext(SubscriptionContext);
  if (!context)
    throw new Error(
      'useSubscription must be used within SubscriptionProvider.',
    );
  return context;
}
