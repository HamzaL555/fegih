import { apiBaseUrl } from '@/api/client';
import type { ApiErrorEnvelope, ApiErrorPayload } from '@/types/api';

export function getApiError(error: unknown): ApiErrorPayload | undefined {
  if (!error || typeof error !== 'object') {
    return undefined;
  }

  const candidate = error as {
    response?: { data?: ApiErrorEnvelope | { error?: ApiErrorPayload } };
    message?: string;
  };
  const payload = candidate.response?.data?.error;
  if (payload) {
    return payload;
  }
  if (candidate.message) {
    return { code: 'UNKNOWN', message: candidate.message };
  }
  return undefined;
}

/** Per-field messages the API returns inside `error.details.issues`. */
function getDetailMessages(details: unknown): string[] {
  if (!details || typeof details !== 'object') return [];
  const issues = (details as { issues?: unknown }).issues;
  if (!Array.isArray(issues)) return [];
  return issues
    .map((issue) => {
      const item = issue as { message?: unknown; path?: unknown };
      if (typeof item.message !== 'string') return undefined;
      const field = Array.isArray(item.path) && item.path.length ? String(item.path[item.path.length - 1]) : undefined;
      return field ? `${field}: ${item.message}` : item.message;
    })
    .filter((message): message is string => Boolean(message));
}

export function getErrorMessage(error: unknown, fallback: string): string {
  const payload = getApiError(error);
  if (!payload) return fallback;
  const details = getDetailMessages(payload.details);
  if (details.length) return `${payload.message} (${details.join('; ')})`;
  return payload.message || fallback;
}

export function getErrorCode(error: unknown): string | undefined {
  return getApiError(error)?.code;
}

export function isUnauthorized(error: unknown): boolean {
  const candidate = error as { response?: { status?: number } } | null;
  return candidate?.response?.status === 401;
}

/** Transport-level failure: DNS, refused connection, or the request timeout. */
export function isNetworkError(error: unknown): boolean {
  if (isUnauthorized(error)) return false;
  const candidate = error as { code?: string; response?: unknown; message?: string } | null;
  if (candidate?.response !== undefined) return false;
  if (candidate?.code === 'ECONNABORTED' || candidate?.code === 'ETIMEDOUT') return true;
  return typeof candidate?.message === 'string' && /network|timeout|timed out|failed to fetch/i.test(candidate.message);
}

export function networkErrorMessage(error: unknown, translate: (key: string) => string): string {
  const base = translate('errors.serverUnreachable');
  const candidate = error as { code?: string } | null;
  const timedOut = candidate?.code === 'ECONNABORTED' || candidate?.code === 'ETIMEDOUT';
  return `${base}\n${apiBaseUrl}\n(${timedOut ? 'timeout' : 'connection failed'})`;
}
