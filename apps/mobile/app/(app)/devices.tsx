import { useAuth } from '@clerk/expo';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, View } from 'react-native';

import { ThemedText } from '../../components/ThemedText';
import { SurfaceCard } from '../../components/ui/SectionHeader';
import { SoftPage } from '../../components/ui/SoftScreen';
import { ThemedButton } from '../../components/ui/ThemedButton';
import { registerPushForSignedInUser } from '../../lib/notifications';
import { unregisterDevicePushToken } from '../../lib/api';
import { useAppTheme } from '../../providers/ThemeProvider';

export default function DevicesScreen() {
  const { getToken } = useAuth();
  const { colors, radius } = useAppTheme();
  const [permission, setPermission] = useState('Checking');
  const [registered, setRegistered] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [status, token, enabled] = await Promise.all([
        Notifications.getPermissionsAsync(),
        SecureStore.getItemAsync('kairos.device.expoPushToken'),
        SecureStore.getItemAsync('kairos.device.pushEnabled'),
      ]);
      setPermission(status.granted ? 'Allowed' : status.status === 'denied' ? 'Denied' : 'Not requested');
      setRegistered(Boolean(token) && enabled !== 'false');
    } catch { setPermission('Unavailable'); setRegistered(false); }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const toggle = async () => {
    setBusy(true); setMessage(null);
    try {
      if (registered) {
        const token = await SecureStore.getItemAsync('kairos.device.expoPushToken');
        const auth = await getToken();
        if (token && auth) await unregisterDevicePushToken({ token: auth, expoPushToken: token });
        await SecureStore.setItemAsync('kairos.device.pushEnabled', 'false');
        setRegistered(false);
      } else {
        const pushToken = await registerPushForSignedInUser(getToken);
        if (!pushToken) {
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          setMessage('Notifications could not be enabled on this device. Check permission and try again.');
        } else {
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          setRegistered(true);
        }
      }
      await refresh();
    } catch { setMessage('Could not update this device. Please try again.'); }
    finally { setBusy(false); }
  };

  return (
    <SoftPage>
      <ThemedText colorKey="textMuted" style={styles.lead}>
        Choose whether this phone can receive Kairos notifications when a capture uploads or a memory is ready.
      </ThemedText>

      <SurfaceCard style={styles.panel}>
        {/* Permission status row */}
        <View style={styles.infoRow}>
          <View style={[styles.infoIcon, { backgroundColor: colors.surfaceContainer }]}>
            <Feather name="bell" size={16} color={colors.textSecondary} />
          </View>
          <View style={styles.infoText}>
            <ThemedText colorKey="text" style={styles.infoLabel}>Notification permission</ThemedText>
            <ThemedText colorKey="textMuted" style={styles.infoValue}>{permission}</ThemedText>
          </View>
          <View style={[
            styles.statusDot,
            { backgroundColor: permission === 'Allowed' ? colors.success : colors.warning },
          ]} />
        </View>

        <View style={[styles.divider, { backgroundColor: colors.borderSubtle }]} />

        {/* Registration row */}
        <View style={styles.infoRow}>
          <View style={[styles.infoIcon, { backgroundColor: registered ? colors.successSurface : colors.surfaceContainer }]}>
            <Feather name="check-circle" size={16} color={registered ? colors.success : colors.textMuted} />
          </View>
          <View style={styles.infoText}>
            <ThemedText colorKey="text" style={styles.infoLabel}>Push token registered</ThemedText>
            <ThemedText colorKey="textMuted" style={styles.infoValue}>{registered ? 'Active on this device' : 'Not registered'}</ThemedText>
          </View>
        </View>

        <View style={[styles.divider, { backgroundColor: colors.borderSubtle }]} />

        {/* Device row */}
        <View style={styles.infoRow}>
          <View style={[styles.infoIcon, { backgroundColor: colors.surfaceContainer }]}>
            <Feather name="smartphone" size={16} color={colors.textSecondary} />
          </View>
          <View style={styles.infoText}>
            <ThemedText colorKey="text" style={styles.infoLabel}>This device</ThemedText>
            <ThemedText colorKey="textMuted" style={styles.infoValue}>
              {Platform.OS === 'ios' ? 'iPhone or iPad' : 'Android'}
            </ThemedText>
          </View>
        </View>
      </SurfaceCard>

      <ThemedButton
        variant={registered ? 'secondary' : 'primary'}
        size="lg"
        disabled={busy}
        label={busy ? '' : (registered ? 'Disable notifications' : 'Enable notifications')}
        onPress={() => void toggle()}
      />

      {message ? (
        <SurfaceCard style={[styles.errorCard, { borderColor: colors.error }]}>
          <ThemedText colorKey="error" accessibilityRole="alert" style={styles.errorText}>
            {message}
          </ThemedText>
        </SurfaceCard>
      ) : null}
    </SoftPage>
  );
}

const styles = StyleSheet.create({
  lead: {
    fontFamily: 'Roboto_400Regular',
    fontSize: 14,
    lineHeight: 21,
  },
  panel: {
    padding: 16,
    gap: 4,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 6,
  },
  infoIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoText: {
    flex: 1,
    gap: 1,
  },
  infoLabel: {
    fontFamily: 'Roboto_500Medium',
    fontSize: 14,
  },
  infoValue: {
    fontFamily: 'Roboto_400Regular',
    fontSize: 13,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  divider: {
    height: 1,
    marginVertical: 4,
  },
  errorCard: {
    padding: 14,
    borderWidth: 1,
  },
  errorText: {
    fontFamily: 'Roboto_400Regular',
    fontSize: 14,
    lineHeight: 20,
  },
});
