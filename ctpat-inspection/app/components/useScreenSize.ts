import { useWindowDimensions } from 'react-native';
import { EXPANDED_MIN_WIDTH } from '../models/theme';

/**
 * The size of the window the app is drawn in, and whether it is wide enough for the
 * expanded layout. It follows the window, not the device: unfolding a foldable, split
 * screen and rotation all change it, and the screens re-lay themselves out.
 */
export default function useScreenSize() {
  const { width, height } = useWindowDimensions();
  return { width, height, isExpanded: width >= EXPANDED_MIN_WIDTH };
}
