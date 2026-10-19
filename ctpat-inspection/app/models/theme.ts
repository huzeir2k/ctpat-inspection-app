import { Platform } from 'react-native';

/**
 * Sizing rules shared by every screen. Change a number here and the whole app follows.
 * All values are in density-independent points, never pixels.
 */

export const SPACING = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

/** A window this wide or wider (unfolded foldable, split screen on a tablet) gets the expanded layout. */
export const EXPANDED_MIN_WIDTH = 600;

/** Widest a single-column screen grows before it is centred with empty space either side. */
export const CONTENT_MAX_WIDTH = 640;
/** Widest a screen with two columns grows. */
export const WIDE_CONTENT_MAX_WIDTH = 1040;

/** Smallest comfortable tap area: Apple recommends 44 pt, Android 48 dp. */
export const MIN_TOUCH_TARGET = Platform.OS === 'ios' ? 44 : 48;

/**
 * How far the system's "larger text" setting may enlarge text. Body text can grow to 200%,
 * which is the usual accessibility target. Text in fixed-size chrome (buttons, tabs, headers)
 * stops at 150% so it cannot outgrow the space around it; those labels still wrap.
 */
export const FONT_SCALE_LIMIT = { body: 2, chrome: 1.5 } as const;

export const COLORS = {
  primary: '#007AFF',
  headerText: '#ffffff',
  background: '#f5f5f5',
} as const;
