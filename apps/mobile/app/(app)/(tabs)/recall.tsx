import { Redirect } from 'expo-router';

import { tabHref } from '../../../lib/lastRoute';

export default function RecallRouteRedirect() {
  return <Redirect href={tabHref() as '/(app)/(tabs)'} />;
}
