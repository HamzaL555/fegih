/**
 * Cover normalisation, run in the browser before an upload leaves the panel.
 *
 * Editors paste whatever they have — a screenshot, a 3000px scan, a square
 * export — and the store grid then crops each one differently. Everything is
 * centre-cropped to the standard book proportion and scaled to the standard
 * pixel box here, so the catalogue looks uniform no matter what was uploaded
 * and the API never has to resize anything.
 */

/** Width / height of every stored cover. 2:3 is the common book proportion. */
export const COVER_RATIO = 2 / 3;

/** The pixel box covers are normalised to: 600x900. */
export const COVER_WIDTH = 600;
export const COVER_HEIGHT = 900;

/** Rejected outright rather than silently re-encoded into a huge file. */
export const COVER_MAX_BYTES = 8 * 1024 * 1024;

/** Output quality; 0.9 keeps a cover visually lossless well under 100 kB. */
const QUALITY = 0.9;

export class CoverError extends Error {}

/**
 * Centre-crops `file` to 2:3 and re-encodes it at 600x900.
 *
 * The crop is centred rather than fitted so the title on a cover is never cut
 * off at the bottom. Returns the original file untouched when it cannot decode
 * (an SVG, say) — a broken image is better than a rejected upload.
 */
export async function normaliseCover(file: File): Promise<File> {
  if (file.size > COVER_MAX_BYTES) {
    throw new CoverError(`Fayl çox böyükdir (${Math.round(file.size / 1024 / 1024)} MB). Maksimum 8 MB.`);
  }

  let bitmap: ImageBitmap;
  try {
    // `from-image` applies the EXIF rotation; without it a photo shot in
    // portrait uploads sideways.
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    return file;
  }

  const { width, height } = bitmap;
  const targetRatio = COVER_WIDTH / COVER_HEIGHT;
  const sourceRatio = width / height;

  // Wide artwork is trimmed left/right, tall artwork top/bottom.
  const cropWidth = sourceRatio > targetRatio ? Math.round(height * targetRatio) : width;
  const cropHeight = sourceRatio > targetRatio ? height : Math.round(width / targetRatio);
  const cropX = Math.round((width - cropWidth) / 2);
  const cropY = Math.round((height - cropHeight) / 2);

  const canvas = document.createElement('canvas');
  canvas.width = COVER_WIDTH;
  canvas.height = COVER_HEIGHT;
  const context = canvas.getContext('2d');
  if (!context) {
    bitmap.close();
    return file;
  }
  // JPEG has no alpha; without a fill, transparent regions come out black.
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, COVER_WIDTH, COVER_HEIGHT);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.drawImage(bitmap, cropX, cropY, cropWidth, cropHeight, 0, 0, COVER_WIDTH, COVER_HEIGHT);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', QUALITY));
  if (!blob) return file;

  const name = file.name.replace(/\.[^.]+$/, '') || 'cover';
  return new File([blob], `${name}.jpg`, { type: 'image/jpeg', lastModified: Date.now() });
}

/** Reads the natural size of an image without keeping it around. */
export async function readCoverSize(file: File): Promise<{ width: number; height: number } | null> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const size = { width: bitmap.width, height: bitmap.height };
    bitmap.close();
    return size;
  } catch {
    return null;
  }
}