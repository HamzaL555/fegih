/**
 * Book cover geometry, defined once.
 *
 * Covers arrive at wildly different aspect ratios from the admin panel, so the
 * grid used to render them at whatever `resizeMode="cover"` happened to crop.
 * Pinning one ratio (2:3, the common trade paperback proportion) means a shelf
 * always looks like a shelf. Screens must use `<BookCover>` rather than
 * `<Image>` so the numbers below cannot drift apart.
 */

/** Width / height. 2:3 — the standard book proportion. */
export const COVER_RATIO = 2 / 3;

export type CoverSize = 'thumb' | 'detail' | 'hero';

export const COVER_SIZES = {
  /** Store grid and cart rows. */
  thumb: { width: 120, height: 180 },
  /** Book detail page, inside the card. */
  detail: { width: 240, height: 360 },
  /** Promotional placements. */
  hero: { width: 320, height: 480 },
} as const satisfies Record<CoverSize, { width: number; height: number }>;

/**
 * The size an uploaded cover is normalised to by the admin panel: large enough
 * to stay sharp on a 3x phone, small enough that a catalogue stays quick.
 */
export const COVER_UPLOAD = { width: 600, height: 900 } as const;

/** Long edge accepted for an upload, in pixels. */
export const COVER_MAX_UPLOAD_EDGE = 2000;

/** Above this the file is rejected outright rather than silently re-encoded. */
export const COVER_MAX_UPLOAD_BYTES = 8 * 1024 * 1024;