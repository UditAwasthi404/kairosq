import { Image, StyleSheet, View, ActivityIndicator } from 'react-native';

import { useAppTheme } from '../../providers/ThemeProvider';
import { darkTheme, lightTheme } from '../../theme';

export function SplashLoading() {
  const { isLight } = useAppTheme();
  const theme = isLight ? lightTheme : darkTheme;

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Image
        source={
          isLight
            ? require('../../assets/logo-dark.png')
            : require('../../assets/logo-light.png')
        }
        style={styles.logo}
        resizeMode="contain"
      />
      <View style={styles.loaderWrap}>
        <ActivityIndicator size="small" color={theme.textMuted} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  logo: {
    width: 100,
    height: 100,
  },
  loaderWrap: {
    marginTop: 32,
  },
});