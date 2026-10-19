import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Text from './AppText';
import ContentWidth from './ContentWidth';
import { COLORS, MIN_TOUCH_TARGET, SPACING, WIDE_CONTENT_MAX_WIDTH } from '../models/theme';

interface Props {
  title: string;
  /** Defaults to going back one screen. */
  onBack?: () => void;
}

/**
 * The blue bar at the top of every signed-in screen except Home. It starts below the
 * status bar / notch on every device, using the real inset instead of a guessed number.
 */
export default function AppHeader({ title, onBack }: Props) {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.bar,
        {
          paddingTop: insets.top + SPACING.sm,
          paddingLeft: Math.max(insets.left, SPACING.lg),
          paddingRight: Math.max(insets.right, SPACING.lg),
        },
      ]}
    >
      {/* White icons on the blue bar; the previous style returns when this screen closes. */}
      <StatusBar style="light" />
      <ContentWidth maxWidth={WIDE_CONTENT_MAX_WIDTH} style={styles.row}>
        <View style={styles.side}>
          <TouchableOpacity
            style={styles.back}
            onPress={onBack ?? (() => router.back())}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Text chrome style={styles.backText}>
              ← Back
            </Text>
          </TouchableOpacity>
        </View>
        <Text chrome style={styles.title} numberOfLines={2} accessibilityRole="header">
          {title}
        </Text>
        {/* Same width as the left side, so the title stays centred. */}
        <View style={styles.side} />
      </ContentWidth>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: COLORS.primary,
    paddingBottom: SPACING.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  side: {
    flexGrow: 1,
    flexBasis: 0,
    minWidth: 64,
  },
  back: {
    minHeight: MIN_TOUCH_TARGET,
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  backText: { fontSize: 17, color: COLORS.headerText, fontWeight: '600' },
  title: {
    flexShrink: 1,
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.headerText,
    textAlign: 'center',
  },
});
