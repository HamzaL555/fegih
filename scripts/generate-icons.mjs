/**
 * Renders the app icon set from vector artwork defined here.
 *
 * The artwork lives in this file rather than in a checked-in SVG because the
 * launcher icon and the Android adaptive foreground must stay pixel-identical
 * apart from the background; keeping one copy of the geometry makes that
 * impossible to get wrong. Re-run with `npm run icons` after any tweak.
 *
 *   node scripts/generate-icons.mjs
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'apps/mobile/assets');

const TEAL_DARK = '#0F766E';
const TEAL_MID = '#0D9488';
const TEAL_LIGHT = '#14B8A6';

/**
 * A crescent is a disc with a second, offset disc punched out of it. Building
 * it as two circles under `fill-rule="evenodd"` is far more predictable than
 * hand-writing the intersection arcs.
 *
 * The hole is only 10 units smaller than the disc and pushed 50 units toward
 * the top right, so the remaining lune tapers to horns near (180,131) and
 * (321,320) instead of reading as a plain ring.
 */
const CRESCENT_OUTER = { x: 250, y: 226, r: 118 };
const CRESCENT_HOLE = { x: 290, y: 196, r: 128 };
const STAR_AT = { x: 312, y: 182 };

const circle = ({ x, y, r }) =>
  `M${x} ${y - r}A${r} ${r} 0 1 0 ${x} ${y + r}A${r} ${r} 0 1 0 ${x} ${y - r}Z`;

/** Five-pointed star with an outer radius of 44, centred on the origin. */
const STAR = 'M0 -44L10.6 -14.6L41.8 -13.6L17.1 5.6L25.9 35.6L0 18L-25.9 35.6L-17.1 5.6L-41.8 -13.6L-10.6 -14.6Z';

const crescentAndStar = `
    <path fill-rule="evenodd" d="${circle(CRESCENT_OUTER)}${circle(CRESCENT_HOLE)}"/>
    <g transform="translate(${STAR_AT.x} ${STAR_AT.y}) rotate(-12)"><path d="${STAR}"/></g>`;

/** An open book: two mirrored pages that curve up towards the spine. */
const book = `
    <g opacity="0.96">
      <path d="M118 356Q182 338 246 348L246 400Q182 390 118 404Z"/>
      <path d="M394 356Q330 338 266 348L266 400Q330 390 394 404Z"/>
    </g>`;

/** The mark, drawn on a 512x512 grid so it can be scaled into either layer. */
const ART = `
  <g fill="#ffffff">${crescentAndStar}${book}
  </g>`;

/**
 * Notification badges are drawn at roughly 96px. The book turns to mush at that
 * size, so the small variant drops it and keeps the crescent and star.
 */
const ART_COMPACT = `
  <g fill="#ffffff" transform="translate(0 34) scale(1.1) translate(-256 -226)">${crescentAndStar}
  </g>`;

const svg = (size, inner) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">${inner}</svg>`;

/** Teal plate with an optional rounded mask, used as the launcher backdrop. */
const plate = (inner, { radius = 112, flat = false } = {}) => `
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${TEAL_DARK}"/>
      <stop offset="55%" stop-color="${TEAL_MID}"/>
      <stop offset="100%" stop-color="${TEAL_LIGHT}"/>
    </linearGradient>
    <linearGradient id="sheen" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.22"/>
      <stop offset="60%" stop-color="#ffffff" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" ${flat ? '' : `rx="${radius}"`} fill="${flat ? TEAL_MID : 'url(#bg)'}"/>
  ${flat ? '' : `<rect width="512" height="512" rx="${radius}" fill="url(#sheen)"/>`}
  ${inner}`;

/** Launcher icon: gradient plate plus the mark. */
const launcher = svg(512, plate(ART));

/**
 * Android adaptive foreground. The system masks and crops this, so the art is
 * inset to the middle ~66% and painted flat: the background colour is supplied
 * by `adaptiveIcon.backgroundColor` in app.json.
 */
const adaptive = svg(512, `
  <g transform="translate(256 256) scale(0.66) translate(-256 -256)">${ART}</g>`);

const TARGETS = [
  { file: 'icon.png', markup: launcher, size: 1024 },
  { file: 'icon-512.png', markup: launcher, size: 512 },
  { file: 'splash-icon.png', markup: launcher, size: 512, flatten: '#ffffff' },
  { file: 'favicon.png', markup: launcher, size: 48 },
  { file: 'notification.png', markup: svg(512, plate(ART_COMPACT, { flat: true })), size: 96 },
  { file: 'android-icon-foreground.png', markup: adaptive, size: 1024 },
  { file: 'android-icon-background.png', flat: TEAL_DARK, size: 1024 },
  // PWA icons for the web manifest.
  { file: 'pwa-192.png', markup: launcher, size: 192 },
  { file: 'pwa-512.png', markup: launcher, size: 512 },
  // A maskable icon is cropped to a circle by the launcher, so the artwork has
  // to sit inside a safe circle: the same art, scaled down and centred.
  { file: 'pwa-maskable-512.png', markup: svg(512, plate(`<g transform="translate(256 256) scale(0.72) translate(-256 -256)">${ART}</g>`)), size: 512 },
];

await mkdir(out, { recursive: true });
await mkdir(join(root, 'apps/mobile/public'), { recursive: true });

for (const target of TARGETS) {
  let pipeline;
  if (target.markup) {
    pipeline = sharp(Buffer.from(target.markup)).resize(target.size, target.size);
    // iOS rejects splash art that carries an alpha channel.
    if (target.flatten) pipeline = pipeline.flatten({ background: target.flatten });
  } else {
    pipeline = sharp({
      create: { width: target.size, height: target.size, channels: 4, background: target.flat },
    });
  }
  const buffer = await pipeline.png({ compressionLevel: 9 }).toBuffer();
  await writeFile(join(out, target.file), buffer);
  // The web manifest addresses the PWA icons from the site root, and only
  // `public/` is copied there verbatim.
  if (target.file.startsWith('pwa-')) {
    await writeFile(join(root, 'apps/mobile/public', target.file), buffer);
  }
  console.log(`  ${target.file.padEnd(30)} ${String(target.size).padStart(4)}px  ${(buffer.length / 1024).toFixed(1)} kB`);
}

console.log('Hazirdir.');