import { ApiError } from './api-error.js';

/**
 * CORS origin policy shared by the Express app and its tests.
 *
 * A request without an `Origin` header (native apps, server-to-server, health
 * checks) is always allowed. Browser origins must be explicitly listed.
 *
 * A rejected origin is a *client* error, not a server crash. The old code
 * passed `new Error(...)` to the callback, which the global error handler
 * reported as HTTP 500. That made every POST from an unlisted origin (a custom
 * domain, a preview URL, localhost) look like an API outage, while GETs without
 * an `Origin` header kept working.
 */
export function isOriginAllowed(origin: string | undefined, allowedOrigins: readonly string[]): boolean {
  return !origin || allowedOrigins.includes(origin);
}

export function corsOrigin(
  origin: string | undefined,
  allowedOrigins: readonly string[],
  callback: (error: Error | null, allow?: boolean) => void,
): void {
  if (isOriginAllowed(origin, allowedOrigins)) {
    callback(null, true);
    return;
  }
  callback(new ApiError(403, 'CORS_ORIGIN_NOT_ALLOWED', 'Origin is not allowed by CORS', { origin }));
}
