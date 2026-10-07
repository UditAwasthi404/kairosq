type NativeIntentArgs = {
  path: string;
  initial: boolean;
};

function querySuffix(path: string): string {
  const index = path.indexOf('?');
  return index >= 0 ? path.slice(index) : '';
}

function normalize(path: string): string {
  return path
    .replace(/^kairos:\/\//i, '')
    .replace(/^\/+/, '')
    .split('#')[0];
}

/**
 * Maps OS entry points (widget, share, keyboard, custom scheme)
 * onto the existing Expo Router tree. Does not create a second router.
 */
export function redirectSystemPath({ path }: NativeIntentArgs): string {
  const raw = normalize(path);
  const [withoutQuery] = raw.split('?');
  const suffix = querySuffix(path.includes('?') ? path : raw);

  if (withoutQuery === 'capture' || withoutQuery === '(app)/(tabs)/capture') {
    return `/quick-capture${suffix}`;
  }
  if (withoutQuery === 'voice') {
    return `/voice-capture${suffix}`;
  }
  if (withoutQuery === 'insight') {
    return `/insight${suffix}`;
  }
  if (withoutQuery === 'dashboard') {
    return `/dashboard${suffix}`;
  }
  if (withoutQuery === 'predictions') {
    return `/predictions${suffix}`;
  }
  if (withoutQuery === 'brief') {
    return `/brief${suffix}`;
  }
  if (withoutQuery === 'ask') {
    return `/ask${suffix}`;
  }
  if (withoutQuery.startsWith('project/')) {
    return `/projects/${withoutQuery.slice('project/'.length)}${suffix}`;
  }
  if (withoutQuery.startsWith('observation/')) {
    return `/observation/${withoutQuery.slice('observation/'.length)}${suffix}`;
  }
  if (withoutQuery === 'notifications' || withoutQuery === 'updates') {
    return `/notifications${suffix}`;
  }
  if (
    withoutQuery.startsWith('share') ||
    withoutQuery.includes('android.intent.action.SEND') ||
    path.startsWith('content://')
  ) {
    return `/quick-capture?source=SHARE`;
  }
  return path;
}
