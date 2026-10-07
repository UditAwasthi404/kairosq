import { Redirect } from 'expo-router';

import { lastGoodHref } from '../lib/lastRoute';

export default function NotFound() {
  return <Redirect href={lastGoodHref() as '/(app)/(tabs)'} />;
}
