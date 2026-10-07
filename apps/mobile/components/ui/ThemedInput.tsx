import React, { useState } from 'react';
import { TextInput, TextInputProps, StyleSheet, View } from 'react-native';

import { useAppTheme } from '../../providers/ThemeProvider';

export function ThemedInput(props: TextInputProps) {
  const { colors, radius, typography, spacing, isLight } = useAppTheme();
  const [focused, setFocused] = useState(false);

  return (
    <View
      style={[
        styles.wrapper,
        {
          borderRadius: radius.md,
          backgroundColor: colors.inputFill,
          borderColor: focused ? colors.borderActive : colors.inputBorder,
          borderWidth: focused ? 1.5 : 1,
        },
      ]}
    >
      <TextInput
        placeholderTextColor={colors.inputPlaceholder}
        keyboardAppearance={isLight ? 'light' : 'dark'}
        {...props}
        onFocus={(e) => {
          setFocused(true);
          props.onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          props.onBlur?.(e);
        }}
        style={[
          styles.input,
          {
            color: colors.text,
            paddingHorizontal: spacing['4'],
            paddingVertical: spacing['3'],
            fontSize: typography.body.size,
            lineHeight: typography.body.lineHeight,
          },
          props.style,
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    overflow: 'hidden',
  },
  input: {
    fontFamily: 'Roboto_400Regular',
    minHeight: 48,
  },
});