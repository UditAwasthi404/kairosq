import { Link } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';

import { useAppTheme } from '../../providers/ThemeProvider';
import { ThemedText } from '../ThemedText';

type ThemedLinkProps = {
  href: string;
  label: string;
};

/** Text-only navigation link — accent red. */
export function ThemedLink({ href, label }: ThemedLinkProps) {
  const { typography } = useAppTheme();

  return (
    <Link href={href} asChild>
      <Pressable style={{ alignSelf: 'flex-start' }}>
        <ThemedText
          colorKey="accent"
          style={[
            styles.link,
            {
              fontSize: typography.bodySmall.size,
            },
          ]}
        >
          {label}
        </ThemedText>
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  link: {
    fontFamily: 'Roboto_600SemiBold',
    letterSpacing: 0.2,
  },
});
