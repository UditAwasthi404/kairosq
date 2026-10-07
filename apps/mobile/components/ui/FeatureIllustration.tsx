import { Feather } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

import { useAppTheme } from '../../providers/ThemeProvider';

type Size = 'card' | 'hero';

type Props = {
  id: string;
  size?: Size;
};

const ICONS: Record<string, React.ComponentProps<typeof Feather>['name']> = {
  'quick-capture': 'plus',
  voice: 'mic',
  keyboard: 'type',
  share: 'share-2',
  widget: 'grid',
  memories: 'file-text',
  related: 'git-merge',
  search: 'search',
  timeline: 'clock',
  topics: 'hash',
  projects: 'folder',
  ask: 'message-circle',
  dashboard: 'bar-chart-2',
  predictions: 'zap',
  brief: 'book-open',
  offline: 'wifi-off',
  recall: 'eye',
};

export function FeatureIllustration({ id, size = 'card' }: Props) {
  const { colors } = useAppTheme();
  const hero = size === 'hero';

  return (
    <View
      style={[
        styles.frame,
        {
          width: hero ? '100%' : 72,
          height: hero ? 148 : 72,
          backgroundColor: colors.background,
          borderWidth: 1,
          borderColor: colors.primary,
        },
      ]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Marks id={id} accent={colors.accent} surface={colors.surface} />
      <View
        style={[
          styles.orb,
          {
            backgroundColor: colors.surface,
            borderColor: colors.glassBorder,
            width: hero ? 58 : 36,
            height: hero ? 58 : 36,
            borderRadius: 999,
          },
        ]}
      >
        <Feather
          name={ICONS[id] ?? 'info'}
          size={hero ? 24 : 16}
          color={colors.accent}
        />
      </View>
    </View>
  );
}

function Marks({
  id,
  accent,
  surface,
}: {
  id: string;
  accent: string;
  surface: string;
}) {
  if (id === 'voice' || id === 'ask') {
    return (
      <>
        <View style={[styles.ring, { borderColor: `${accent}55`, width: 88, height: 88 }]} />
        <View style={[styles.ring, { borderColor: `${accent}33`, width: 118, height: 118 }]} />
      </>
    );
  }
  if (id === 'timeline' || id === 'offline') {
    return (
      <View style={styles.timeline}>
        {[0.85, 0.5, 0.7].map((width, index) => (
          <View key={index} style={styles.timelineRow}>
            <View style={[styles.node, { backgroundColor: accent }]} />
            <View
              style={[
                styles.bar,
                { backgroundColor: surface, width: `${width * 100}%` as `${number}%` },
              ]}
            />
          </View>
        ))}
      </View>
    );
  }
  if (id === 'search' || id === 'topics') {
    return (
      <View style={styles.chipStack}>
        <View style={[styles.chip, { backgroundColor: `${accent}33`, width: 54 }]} />
        <View style={[styles.chip, { backgroundColor: `${accent}22`, width: 38 }]} />
      </View>
    );
  }
  if (id === 'dashboard' || id === 'predictions' || id === 'brief') {
    return (
      <View style={styles.bars}>
        {[18, 28, 14, 24].map((height, index) => (
          <View
            key={index}
            style={[styles.col, { height, backgroundColor: index === 1 ? accent : `${accent}44` }]}
          />
        ))}
      </View>
    );
  }
  if (id === 'related' || id === 'projects') {
    return (
      <>
        <View style={[styles.cardGhost, { backgroundColor: `${accent}18`, top: 16, left: 18 }]} />
        <View style={[styles.cardGhost, { backgroundColor: `${accent}12`, top: 28, left: 34 }]} />
      </>
    );
  }
  return (
    <>
      <View style={[styles.cardGhost, { backgroundColor: `${accent}14`, right: 16, top: 18 }]} />
      <View style={[styles.leaf, { backgroundColor: `${accent}30` }]} />
    </>
  );
}

const styles = StyleSheet.create({
  frame: {
    borderRadius: 28,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  orb: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth * 2,
    zIndex: 2,
  },
  ring: {
    position: 'absolute',
    borderRadius: 999,
    borderWidth: 1,
  },
  timeline: {
    position: 'absolute',
    left: 16,
    right: 16,
    gap: 8,
  },
  timelineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  node: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  bar: {
    height: 6,
    borderRadius: 999,
  },
  chipStack: {
    position: 'absolute',
    right: 14,
    bottom: 14,
    gap: 6,
    alignItems: 'flex-end',
  },
  chip: {
    height: 8,
    borderRadius: 999,
  },
  bars: {
    position: 'absolute',
    bottom: 16,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
  },
  col: {
    width: 8,
    borderRadius: 999,
  },
  cardGhost: {
    position: 'absolute',
    width: 46,
    height: 32,
    borderRadius: 12,
  },
  leaf: {
    position: 'absolute',
    left: 18,
    bottom: 18,
    width: 16,
    height: 16,
    borderRadius: 8,
  },
});
