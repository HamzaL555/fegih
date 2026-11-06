/**
 * Adds the installable-app tags to the exported web document.
 *
 * Expo Router's `+html.tsx` only applies to the dev server and to static
 * output. The deployed build is a single-page app, and the CLI writes a
 * generic `index.html` for it — without `viewport-fit=cover`, without the
 * manifest link, and without the Apple web-app tags.
 *
 * That matters for the phone: added to the home screen, the site should open
 * standalone, in portrait, with the content painting into the notch area and
 * the safe-area insets reported correctly. Without these tags it opens as a
 * plain web page with a browser bar and a cropped layout.
 *
 * Run after `expo export --platform web`.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const appRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const target = join(appRoot, 'dist/index.html');

const TAGS = [
  '<link rel="manifest" href="/manifest.json" />',
  '<link rel="apple-touch-icon" href="/pwa-192.png" />',
  '<meta name="apple-mobile-web-app-capable" content="yes" />',
  '<meta name="mobile-web-app-capable" content="yes" />',
  '<meta name="apple-mobile-web-app-title" content="Fegih" />',
  '<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />',
];

const STYLE = `<style>
      /* A standalone install has no browser chrome: the page must not scroll
         behind the status bar or the home indicator. */
      @media (display-mode: standalone) {
        html, body { height: 100dvh; overflow: hidden; }
      }
    </style>`;

let html;
try {
  html = await readFile(target, 'utf8');
} catch {
  console.error(`[web-html] ${target} tapılmadı. Əvvəlcə "expo export --platform web" işlədin.`);
  process.exit(1);
}

// The viewport tag has to be replaced, not duplicated: the browser only honours
// the first one, and the default is missing `viewport-fit=cover`.
const withViewport = html.replace(
  /<meta name="viewport"[^>]*\/?>/,
  '<meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover" />',
);

const head = withViewport.replace('</head>', `    ${TAGS.join('\n    ')}\n    ${STYLE}\n  </head>`);

await writeFile(target, head, 'utf8');
console.log('[web-html] manifest + viewport-fit + apple tags elave edildi');