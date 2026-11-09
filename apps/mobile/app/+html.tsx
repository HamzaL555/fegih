import { ScrollViewStyleReset } from 'expo-router/html';

/**
 * Customises the generated HTML document for the web build.
 *
 * Two things matter here:
 *
 * 1. `viewport-fit=cover` lets the app paint into the notch and the home
 *    indicator area. Without it the safe-area insets are always zero and the
 *    content ends up under the status bar when the site is added to the home
 *    screen.
 * 2. The manifest link and the Apple web-app tags are what turn the site into
 *    an installable app: opened from the home screen it runs standalone, with
 *    no browser chrome, in portrait.
 */
export default function html({ children }: { children: React.ReactNode }) {
  return (
    <html lang="az">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover"
        />
        <meta name="theme-color" content="#0F766E" />
        <meta name="description" content="İslami viktorina, məlumat və kitab mağazası" />

        {/* Installable app. */}
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/assets/icon.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content="Fəqih" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />

        <ScrollViewStyleReset />

        <style dangerouslySetInnerHTML={{ __html: `
          html, body { height: 100%; }
          body { overscroll-behavior-y: none; }
          /* A standalone install has no browser chrome, so the page should not
             scroll behind the status bar or the home indicator. */
          @media (display-mode: standalone) {
            html, body { height: 100dvh; overflow: hidden; }
          }
        ` }} />
      </head>
      <body>{children}</body>
    </html>
  );
}