import { StyleSheet, View } from 'react-native';

import { ThemedText } from '../../components/ThemedText';
import { useAppTheme } from '../../providers/ThemeProvider';

type PlaceholderScreenProps = {
  title: string;
  subtitle: string;
};

export function PlaceholderScreen({ title, subtitle }: PlaceholderScreenProps) {
  const { colors, spacing, radius } = useAppTheme();

  return (
    <View style={[styles.container, { padding: spacing['8'], gap: spacing['4'] }]}>
      <View
        style={{
          width: 10,
          height: 10,
          borderRadius: radius.sm,
          backgroundColor: colors.accent,
          marginBottom: spacing['2'],
        }}
      />
      <ThemedText colorKey="text" style={styles.title}>
        {title}
      </ThemedText>
      <ThemedText colorKey="textSecondary" style={styles.subtitle}>
        {subtitle}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontFamily: 'Roboto_400Regular',
    fontSize: 32,
    letterSpacing: 4,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: 'Roboto_400Regular',
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 300,
    letterSpacing: -0.1,
  },
});