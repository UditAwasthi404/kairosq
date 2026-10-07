import { Redirect } from 'expo-router';
import { Platform } from 'react-native';
import Recall from 'kairos-recall';

import { tabHref } from '../../lib/lastRoute';
import RecallScreen from './(tabs)/recall-screen';

export default function ScreenMemoryRoute() {
  if (Platform.OS !== 'android' || !Recall.isAvailable()) {
    return <Redirect href={tabHref() as '/(app)/(tabs)'} />;
  }
  return <RecallScreen />;
}
