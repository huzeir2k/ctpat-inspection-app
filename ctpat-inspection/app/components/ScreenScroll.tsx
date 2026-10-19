import React from 'react';
import { ScrollView, ScrollViewProps, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CONTENT_MAX_WIDTH, SPACING } from '../models/theme';

export interface ScreenScrollProps extends ScrollViewProps {
  /** Content stops growing at this width and is centred. */
  maxContentWidth?: number;
}

/**
 * A ScrollView for a whole screen. It keeps content clear of the notch edges and the
 * home bar / gesture bar, and centres it at a readable width on wide windows.
 */
export default function ScreenScroll({
  children,
  contentContainerStyle,
  maxContentWidth = CONTENT_MAX_WIDTH,
  ...scrollViewProps
}: ScreenScrollProps) {
  const insets = useSafeAreaInsets();

  return (
    <ScrollView
      contentContainerStyle={[
        {
          paddingLeft: insets.left,
          paddingRight: insets.right,
          paddingBottom: SPACING.xl + insets.bottom,
        },
        contentContainerStyle,
      ]}
      {...scrollViewProps}
    >
      <View style={{ width: '100%', maxWidth: maxContentWidth, alignSelf: 'center', flexGrow: 1 }}>{children}</View>
    </ScrollView>
  );
}
