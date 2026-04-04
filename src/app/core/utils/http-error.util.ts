import { HttpErrorResponse } from '@angular/common/http';

/** Backend messages we map to translation keys (see en.json / ar.json). */
const API_MESSAGE_TO_I18N_KEY: Record<string, string> = {
  'Branch limit reached for this parent.': 'SUPER_ADMIN.ERROR_BRANCH_LIMIT_REACHED',
};

/** Backend `error.code` from JSON body (e.g. DUPLICATE_TENANT_SLUG). */
export function extractHttpErrorCode(err: unknown): string | undefined {
  if (!err || typeof err !== 'object') {
    return undefined;
  }
  const e = err as HttpErrorResponse;
  const body = e.error;
  if (body && typeof body === 'object' && body !== null && 'code' in body) {
    const c = (body as { code?: unknown }).code;
    if (typeof c === 'string' && c.trim()) {
      return c.trim();
    }
  }
  return undefined;
}

/**
 * Reads a user-facing message from an Angular HTTP error (or compatible shape).
 */
export function extractHttpErrorMessage(err: unknown): string | undefined {
  if (!err || typeof err !== 'object') {
    return undefined;
  }
  const e = err as HttpErrorResponse;
  const body = e.error;

  if (body != null) {
    if (typeof body === 'string') {
      try {
        const parsed = JSON.parse(body) as { message?: unknown };
        if (typeof parsed?.message === 'string' && parsed.message.trim()) {
          return parsed.message.trim();
        }
      } catch {
        const t = body.trim();
        return t || undefined;
      }
    } else if (typeof body === 'object' && body !== null && 'message' in body) {
      const m = (body as { message?: unknown }).message;
      if (typeof m === 'string' && m.trim()) {
        return m.trim();
      }
    }
  }

  if (
    typeof e.message === 'string' &&
    e.message &&
    !e.message.startsWith('Http failure response for')
  ) {
    return e.message;
  }
  return undefined;
}

/**
 * Resolves a `formError` value: translation key for known API strings, otherwise raw message or fallback key.
 */
export function formErrorKeyFromHttp(err: unknown, fallbackI18nKey: string): string {
  const code = extractHttpErrorCode(err);
  const raw = extractHttpErrorMessage(err);
  if (code === 'DUPLICATE_TENANT_SLUG') {
    if (raw) {
      return raw;
    }
    return 'SUPER_ADMIN.DUPLICATE_TENANT_SLUG';
  }
  if (!raw) {
    return fallbackI18nKey;
  }
  return API_MESSAGE_TO_I18N_KEY[raw] ?? raw;
}
