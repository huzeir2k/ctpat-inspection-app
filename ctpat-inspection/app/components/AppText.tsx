import React from 'react';
import { Text, TextProps } from 'react-native';
import { FONT_SCALE_LIMIT } from '../models/theme';

interface Props extends TextProps {
  /** Text inside fixed-size UI (buttons, tabs, headers): it may enlarge less than body text. */
  chrome?: boolean;
}

/**
 * The app's Text. Same as React Native's, but with a limit on how far the system's
 * "larger text" setting can enlarge it (see FONT_SCALE_LIMIT).
 */
export default function AppText({ chrome = false, maxFontSizeMultiplier, ...textProps }: Props) {
  return (
    <Text
      maxFontSizeMultiplier={maxFontSizeMultiplier ?? (chrome ? FONT_SCALE_LIMIT.chrome : FONT_SCALE_LIMIT.body)}
      {...textProps}
    />
  );
}
