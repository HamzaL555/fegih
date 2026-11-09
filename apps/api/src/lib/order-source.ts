import type { Request } from 'express';

/**
 * Best-effort classification of where an order was placed.
 *
 * The app sends `X-Client-Platform` explicitly. As a fallback, a browser always
 * sends `Origin`/`Referer`, while a native runtime (Expo, okhttp, CFNetwork)
 * does not. The header is not a security boundary — it only decides the
 * `Order.source` label — so a spoofed value has no privilege attached to it.
 */
export function detectOrderSource(request: Request): 'WEB' | 'MOBILE' {
  const platform = (request.header('x-client-platform') ?? '').trim().toLowerCase();
  if (platform === 'mobile' || platform === 'native' || platform === 'ios' || platform === 'android') {
    return 'MOBILE';
  }
  if (platform === 'web' || platform === 'browser') return 'WEB';

  if (request.header('origin') || request.header('referer')) return 'WEB';

  const userAgent = (request.header('user-agent') ?? '').toLowerCase();
  if (/expo|okhttp|cfnetwork|react-native|android|iphone|ipad/.test(userAgent)) return 'MOBILE';
  return 'WEB';
}
