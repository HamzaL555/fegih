import { useWindowDimensions } from 'react-native';

export type Breakpoint = 'phone' | 'tablet' | 'desktop' | 'wide';

export type Responsive = {
  width: number;
  height: number;
  /** Which layout the viewport calls for. */
  size: Breakpoint;
  /** True on a narrow screen, where the app keeps its phone layout. */
  isPhone: boolean;
  /** Columns for a card grid at this width. */
  gridColumns: number;
  /** Width of the centred content column. */
  contentWidth: number;
};

/**
 * Viewport measurements, named.
 *
 * The web build and the native build share every screen, so layout decisions
 * are made from the viewport rather than from the platform: the same app has to
 * look like a website on a desktop and like an app on a phone.
 */
export function useResponsive(): Responsive {
  const { width, height } = useWindowDimensions();

  const size: Breakpoint =
    width >= 1280 ? 'wide' : width >= 1024 ? 'desktop' : width >= 680 ? 'tablet' : 'phone';

  const gridColumns =
    size === 'wide' ? 5 : size === 'desktop' ? 4 : size === 'tablet' ? 4 : 3;

  // The column grows with the window but never past a comfortable reading
  // measure, so lines of text do not run the full width of a monitor.
  const contentWidth = size === 'wide' ? 1080 : size === 'desktop' ? 900 : size === 'tablet' ? 720 : 520;

  return { width, height, size, isPhone: size === 'phone', gridColumns, contentWidth };
}