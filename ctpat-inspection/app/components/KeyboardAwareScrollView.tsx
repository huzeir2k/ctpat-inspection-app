import React from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, ScrollViewProps, StyleSheet } from 'react-native';

/**
 * A ScrollView that keeps the focused input visible above the on-screen keyboard.
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
export default function KeyboardAwareScrollView({
  children,
  contentContainerStyle,
  ...scrollViewProps
}: ScrollViewProps) {
  const scrollView = (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
      automaticallyAdjustKeyboardInsets
      contentContainerStyle={[styles.content, contentContainerStyle]}
      {...scrollViewProps}
    >
      {children}
    </ScrollView>
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
  // Leaves room under the last field so it can scroll clear of the keyboard.
  content: { paddingBottom: 24 },
});
