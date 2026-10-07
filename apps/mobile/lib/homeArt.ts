import type { ImageSourcePropType } from 'react-native';

/** Bundled Ghost of Tsushima stills for Home widgets. */
export const homeArt = {
  fog: require('../assets/home/home-fog-portrait.jpg') as ImageSourcePropType,
  hero: require('../assets/home/home-hero-mist.jpg') as ImageSourcePropType,
  ask: require('../assets/home/home-ask-moon.jpg') as ImageSourcePropType,
  capture: require('../assets/home/home-capture-ink.jpg') as ImageSourcePropType,
  search: require('../assets/home/home-search-lantern.jpg') as ImageSourcePropType,
  dashboard: require('../assets/home/home-dash-castle.jpg') as ImageSourcePropType,
  predictions: require('../assets/home/home-predict-wind.jpg') as ImageSourcePropType,
  path: require('../assets/home/home-path-wide.jpg') as ImageSourcePropType,
  shore: require('../assets/home/home-memory-shore.jpg') as ImageSourcePropType,
  scroll: require('../assets/home/home-memory-scroll.jpg') as ImageSourcePropType,
} as const;

export const INK = {
  bone: '#F3EEE6',
  ash: 'rgba(243,238,230,0.78)',
  mist: 'rgba(243,238,230,0.55)',
  ink: '#0B0B0B',
} as const;
