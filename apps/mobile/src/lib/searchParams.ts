/**
 * Expo Router's `useLocalSearchParams()` returns a plain object, not a
 * `URLSearchParams`. Calling `.get()` on it throws
 * "searchParams.get is not a function" during render, which blanks the whole
 * route. This helper normalises the three shapes a param can take.
 */
export function readParam(
  params: Record<string, string | string[] | undefined> | null | undefined,
  key: string,
): string | undefined {
  const value = params?.[key];
  if (Array.isArray(value)) return value[0];
  return value;
}

/** Reads a positive integer query param, falling back to `fallback`. */
export function readPageParam(
  params: Record<string, string | string[] | undefined> | null | undefined,
  key = 'page',
  fallback = 1,
): number {
  const parsed = Number(readParam(params, key));
  return Number.isFinite(parsed) && parsed >= 1 ? Math.trunc(parsed) : fallback;
}
