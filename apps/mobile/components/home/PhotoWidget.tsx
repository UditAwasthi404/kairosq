import * as Haptics from 'expo-haptics';
import {
  Image,
  ImageSourcePropType,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ImageStyle,
  type StyleProp,
} from 'react-native';

import { INK } from '../../lib/homeArt';

type PhotoWidgetProps = {
  source: ImageSourcePropType;
  label: string;
  value?: string;
  caption?: string;
  onPress: () => void;
  width: number;
  height: number;
  accessibilityLabel: string;
  imageStyle?: StyleProp<ImageStyle>;
};

export function PhotoWidget({
  source,
  label,
  value,
  caption,
  onPress,
  width,
  height,
  accessibilityLabel,
  imageStyle,
}: PhotoWidgetProps) {
  return (
    <Pressable
      onPress={() => {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [
        styles.shell,
        { width, height, opacity: pressed ? 0.92 : 1 },
      ]}
    >
      <Image source={source} resizeMode="cover" style={[styles.photo, imageStyle]} />
      <View style={styles.scrim} pointerEvents="none" />
      <View style={styles.copy}>
        {value ? (
          <Text style={styles.value} numberOfLines={1}>
            {value}
          </Text>
        ) : null}
        <Text style={styles.label} numberOfLines={1}>
          {label}
        </Text>
        {caption ? (
          <Text style={styles.caption} numberOfLines={1}>
            {caption}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  shell: {
    borderRadius: 28,
    overflow: 'hidden',
    backgroundColor: INK.ink,
  },
  photo: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  scrim: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '42%',
    backgroundColor: '#121212',
  },
  copy: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  value: {
    color: INK.bone,
    fontFamily: 'Roboto_400Regular',
    fontSize: 36,
    letterSpacing: -0.8,
    lineHeight: 40,
  },
  label: {
    color: INK.bone,
    fontFamily: 'Roboto_600SemiBold',
    fontSize: 15,
    letterSpacing: -0.2,
  },
  caption: {
    color: INK.ash,
    fontFamily: 'Roboto_400Regular',
    fontSize: 12,
    marginTop: 2,
  },
});
