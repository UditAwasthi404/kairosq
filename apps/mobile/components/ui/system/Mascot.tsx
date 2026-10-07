import { useId } from 'react';
import Svg, { Circle } from 'react-native-svg';

import { useAppTheme } from '../../../providers/ThemeProvider';
import { mascotSize } from '../../../theme';

export type MascotState = 'idle' | 'happy' | 'thinking' | 'celebrating';

type MascotProps = {
  state?: MascotState;
  /** Pixel size. Prefer `mascotSize` from theme.ts. */
  size?: number;
  /** Kept for call sites. Nothing glyphs do not drift. */
  animate?: boolean;
};

const GRID = 5;

/**
 * Nothing-style dot glyph. Red dots mark the active state.
 *
 * ```tsx
 * <Mascot state="thinking" size={mascotSize.md} />
 * ```
 */
export function Mascot({ state = 'idle', size = mascotSize.md }: MascotProps) {
  const { colors } = useAppTheme();
  const titleId = `glyph${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const step = size / GRID;
  const lit = litDots(state);

  return (
    <Svg width={size} height={size} accessibilityElementsHidden>
      {Array.from({ length: GRID * GRID }, (_, index) => {
        const col = index % GRID;
        const row = Math.floor(index / GRID);
        const on = lit.has(index);
        return (
          <Circle
            key={`${titleId}-${index}`}
            cx={col * step + step / 2}
            cy={row * step + step / 2}
            r={on ? step * 0.28 : step * 0.16}
            fill={on ? colors.primary : colors.dotInactive}
          />
        );
      })}
    </Svg>
  );
}

function litDots(state: MascotState): Set<number> {
  const rows: Record<MascotState, number[]> = {
    idle: [6, 8, 16, 18],
    happy: [6, 8, 15, 16, 17, 18, 19],
    thinking: [6, 8, 11, 16, 18, 22],
    celebrating: [0, 4, 6, 8, 12, 16, 18, 20, 24],
  };
  return new Set(rows[state]);
}
