import React from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';
import ScreenScroll, { ScreenScrollProps } from './ScreenScroll';

/**
 * A ScreenScroll that also keeps the focused input visible above the on-screen keyboard.
 * Use it for every screen that contains text inputs.
 *
 * - iOS: the ScrollView itself adds the keyboard's height as bottom inset and scrolls
 *   the focused input into view (`automaticallyAdjustKeyboardInsets`).
 * - Android: the app draws edge to edge, so the system no longer resizes the window
 *   for the keyboard. KeyboardAvoidingView adds the bottom padding instead.
 *
 * Tapping a button while the keyboard is open works on the first tap, and dragging
 * the list dismisses the keyboard.
 */
export default function KeyboardAwareScrollView({ children, ...scrollProps }: ScreenScrollProps) {
  const scrollView = (
    <ScreenScroll
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
      automaticallyAdjustKeyboardInsets
      {...scrollProps}
    >
      {children}
    </ScreenScroll>
  );

  if (Platform.OS !== 'android') {
    return scrollView;
  }

  return (
    <KeyboardAvoidingView style={styles.fill} behavior="padding">
      {scrollView}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
