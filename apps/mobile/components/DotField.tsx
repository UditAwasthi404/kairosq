import { StyleSheet, View } from 'react-native';

import { useAppTheme } from '../providers/ThemeProvider';
import { kairosPalette } from '../theme';

export function DotField({ soft = true }: { soft?: boolean }) {
  const { isLight } = useAppTheme();
  const color = isLight ? kairosPalette.signal[600] : kairosPalette.signal[400];
  const dots = soft
    ? [
        { x: 10, y: 12, s: 4, o: 0.28 },
        { x: 38, y: 6, s: 3, o: 0.18 },
        { x: 64, y: 24, s: 5, o: 0.24 },
        { x: 22, y: 44, s: 3, o: 0.16 },
        { x: 50, y: 50, s: 4, o: 0.22 },
        { x: 78, y: 42, s: 3, o: 0.14 },
      ]
    : Array.from({ length: 12 }, (_, i) => ({
        x: (i % 4) * 24,
        y: Math.floor(i / 4) * 22,
        s: 3,
        o: 0.16,
      }));

  return (
    <View style={styles.field} pointerEvents="none">
      {dots.map((dot, index) => (
        <View
          key={index}
          style={{
            position: 'absolute',
            left: dot.x,
            top: dot.y,
            width: dot.s,
            height: dot.s,
            borderRadius: 999,
            backgroundColor: color,
            opacity: dot.o,
          }}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    width: 100,
    height: 80,
  },
});
