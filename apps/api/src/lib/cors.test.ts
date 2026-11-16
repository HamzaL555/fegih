import { describe, expect, it } from 'vitest';

import { ApiError } from './api-error.js';
import { corsOrigin, isOriginAllowed } from './cors.js';

describe('CORS origin policy', () => {
  it('allows requests without an Origin header (native apps, health checks)', () => {
    expect(isOriginAllowed(undefined, ['https://fegih.vercel.app'])).toBe(true);
  });

  it('allows an explicitly listed browser origin', () => {
    expect(isOriginAllowed('https://fegih.vercel.app', ['https://fegih.vercel.app'])).toBe(true);
  });

  it('rejects an unlisted browser origin with a 403, not a 500', () => {
    const calls: Array<{ error: Error | null; allow?: boolean }> = [];
    corsOrigin('https://evil.example', ['https://fegih.vercel.app'], (error, allow) => {
      calls.push({ error, allow });
    });

    expect(calls).toHaveLength(1);
    const error = calls[0]!.error;
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(403);
    expect((error as ApiError).code).toBe('CORS_ORIGIN_NOT_ALLOWED');
    expect(calls[0]!.allow).toBeUndefined();
  });

  it('passes a null error and allow=true for an allowed origin', () => {
    const calls: Array<{ error: Error | null; allow?: boolean }> = [];
    corsOrigin(undefined, ['https://fegih.vercel.app'], (error, allow) => {
      calls.push({ error, allow });
    });

    expect(calls[0]).toEqual({ error: null, allow: true });
  });
});
