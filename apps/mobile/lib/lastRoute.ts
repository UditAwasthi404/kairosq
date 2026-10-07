export type StableTab = 'index' | 'library' | 'ask' | 'profile';

const STABLE: readonly StableTab[] = ['index', 'library', 'ask', 'profile'];
const SKIP = new Set(['capture', 'recall', 'recall-screen', '+not-found']);

let tab: StableTab = 'index';
let path = '/(app)/(tabs)';

export function tabHref(name: StableTab = tab): string {
  if (name === 'index') return '/(app)/(tabs)';
  return `/(app)/(tabs)/${name}`;
}

export function rememberTab(next: StableTab) {
  tab = next;
  path = tabHref(next);
}

export function rememberedTab(): StableTab {
  return tab;
}

export function rememberPath(href: string) {
  if (!href || href.includes('not-found')) return;
  path = href.startsWith('/') ? href : `/${href}`;
}

/** Last screen that actually exists in the navigator. */
export function lastGoodHref(): string {
  return path || tabHref();
}

export function noteSegments(segments: string[]) {
  const leaf = segments[segments.length - 1];
  if (!leaf || SKIP.has(leaf)) return;

  if (segments.includes('(tabs)')) {
    if (leaf === '(tabs)' || leaf === 'index') rememberTab('index');
    else if ((STABLE as readonly string[]).includes(leaf)) rememberTab(leaf as StableTab);
    return;
  }

  if (segments.includes('(app)')) {
    const href = `/${segments.filter((segment) => !segment.startsWith('(')).join('/')}`;
    if (href.length > 1) rememberPath(href);
  }
}
