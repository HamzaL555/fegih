import { prisma } from '../config/prisma.js';

type SettingValue = unknown;

interface CacheEntry {
  value: SettingValue;
  expiresAt: number;
}

const DEFAULT_TTL_MS = 30_000;
const MAX_ENTRIES = 200;

const cache = new Map<string, CacheEntry>();

/**
 * `SystemSetting` is read on nearly every request (maintenance mode, public
 * settings, registration toggles). Caching it removes a Postgres round trip
 * from the hot path; writes call `invalidateSettingsCache()`.
 */
export async function getSystemSetting<T = SettingValue>(key: string, ttlMs = DEFAULT_TTL_MS): Promise<T | null> {
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.value as T;

  const row = await prisma.systemSetting.findUnique({ where: { key } });
  const value = (row?.value ?? null) as T | null;

  if (cache.size >= MAX_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, { value, expiresAt: Date.now() + ttlMs });
  return value;
}

export function invalidateSettingsCache(key?: string): void {
  if (key) {
    cache.delete(key);
    return;
  }
  cache.clear();
}
