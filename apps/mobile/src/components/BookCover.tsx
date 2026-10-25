import { Image, StyleSheet, View } from 'react-native';

import { COVER_SIZES, type CoverSize } from '@/constants/book-cover';
import { useTheme } from '@/providers/ThemeProvider';

export type BookCoverProps = {
  uri?: string | null;
  size?: CoverSize;
  /** Rounded corners in points. Defaults to a fraction of the standard width. */
  radius?: number;
  style?: object;
};

/**
 * The only way a book cover is rendered.
 *
 * The box is `width: 100%` capped at the standard width with `aspectRatio`
 * derived from it, so a 320pt phone and a tablet both show the same 2:3 crop
 * instead of one of them stretching the artwork. Screens must use this
 * component rather than `<Image>` so the numbers in `COVER_SIZES` cannot drift.
 *
 * The placeholder has the identical box, so nothing shifts when an image is
 * missing or fails to load.
 */
export function BookCover({ uri, size = 'thumb', radius, style }: BookCoverProps) {
  const { colors } = useTheme();
  const standard = COVER_SIZES[size];
  const cornerRadius = radius ?? Math.round(standard.width * 0.12);

  const box = {
    width: '100%' as const,
    maxWidth: standard.width,
    aspectRatio: standard.width / standard.height,
    borderRadius: cornerRadius,
    backgroundColor: colors.surfaceElevated,
  };

  if (!uri) {
    return (
      <View
        accessibilityElementsHidden
        style={[styles.box, box, { borderColor: colors.border }, style]}
      >
        <View style={[styles.spine, { backgroundColor: colors.border }]} />
      </View>
    );
  }

  return (
    <Image
      source={{ uri }}
      // `cover` crops the overflow rather than distorting the artwork.
      resizeMode="cover"
      style={[styles.box, box, style]}
    />
  );
}

const styles = StyleSheet.create({
  box: { overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth },
  /** A hint of a spine so the empty state still reads as a book. */
  spine: { position: 'absolute', left: 8, top: 0, bottom: 0, width: 2, opacity: 0.6 },
});