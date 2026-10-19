import React from 'react';
import { StyleProp, View, ViewStyle } from 'react-native';
import { CONTENT_MAX_WIDTH } from '../models/theme';

interface Props {
  children: React.ReactNode;
  maxWidth?: number;
  style?: StyleProp<ViewStyle>;
}

/** Keeps content to a readable width and centres it when the window is wider. */
export default function ContentWidth({ children, maxWidth = CONTENT_MAX_WIDTH, style }: Props) {
  return <View style={[{ width: '100%', maxWidth, alignSelf: 'center' }, style]}>{children}</View>;
}
