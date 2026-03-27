import { HttpErrorResponse } from '@angular/common/http';

export const SUBSCRIPTION_EXPIRED_CODES = new Set([
  'SUBSCRIPTION_EXPIRED',
  'SUBSCRIPTION_INACTIVE',
  'LICENSE_EXPIRED',
  'PLAN_EXPIRED',
  'TENANT_SUBSCRIPTION_EXPIRED',
]);

function readCodeFromRecord(b: Record<string, unknown>): string {
  const raw = b['error'] ?? b['code'];
  return typeof raw === 'string' ? raw.toUpperCase() : '';
}

/** Login / JSON envelope (not necessarily HttpErrorResponse). */
export function isSubscriptionExpiredApiEnvelope(body: unknown): boolean {
  if (!body || typeof body !== 'object') {
    return false;
  }
  const b = body as Record<string, unknown>;
  if (SUBSCRIPTION_EXPIRED_CODES.has(readCodeFromRecord(b))) {
    return true;
  }
  const msg = String(b['message'] ?? '').toLowerCase();
  if (msg.includes('subscription') && (msg.includes('expir') || msg.includes('renew'))) {
    return true;
  }
  const nested = b['data'];
  if (nested && typeof nested === 'object') {
    const nb = nested as Record<string, unknown>;
    if (SUBSCRIPTION_EXPIRED_CODES.has(readCodeFromRecord(nb))) {
      return true;
    }
  }
  return false;
}

export function getSubscriptionExpiredMessageFromApiEnvelope(body: unknown): string | null {
  if (!isSubscriptionExpiredApiEnvelope(body)) {
    return null;
  }
  const b = body as Record<string, unknown>;
  const top = String(b['message'] ?? '').trim();
  if (top.length > 0) {
    return top;
  }
  const nested = b['data'];
  if (nested && typeof nested === 'object') {
    const m = String((nested as Record<string, unknown>)['message'] ?? '').trim();
    if (m.length > 0) {
      return m;
    }
  }
  return null;
}

function readCode(error: HttpErrorResponse): string {
  const body = error.error as Record<string, unknown> | null | undefined;
  if (!body || typeof body !== 'object') {
    return '';
  }
  const raw = body['error'] ?? body['code'];
  return typeof raw === 'string' ? raw.toUpperCase() : '';
}

function readMessage(error: HttpErrorResponse): string {
  const body = error.error as Record<string, unknown> | string | null | undefined;
  if (typeof body === 'string') {
    return body.trim();
  }
  if (body && typeof body === 'object') {
    const msg = body['message'];
    if (typeof msg === 'string') {
      return msg.trim();
    }
  }
  return typeof error.message === 'string' ? error.message.trim() : '';
}

/**
 * Detects tenant subscription / license expiry from API errors (403, 402, or known codes).
 * Returns a user-facing message, or null to fall back to translated default in the UI.
 */
export function getSubscriptionExpiredMessage(error: unknown): string | null {
  if (!(error instanceof HttpErrorResponse)) {
    return null;
  }

  const code = readCode(error);
  if (SUBSCRIPTION_EXPIRED_CODES.has(code)) {
    const msg = readMessage(error);
    return msg.length > 0 ? msg : null;
  }

  if (error.status === 402) {
    const msg = readMessage(error);
    return msg.length > 0 ? msg : null;
  }

  if (error.status === 403) {
    const raw = readMessage(error);
    const msg = raw.toLowerCase();
    if (
      msg.includes('subscription') &&
      (msg.includes('expir') || msg.includes('renew') || msg.includes('inactive'))
    ) {
      return raw.length > 0 ? raw : null;
    }
  }

  return null;
}

export function isSubscriptionExpiredHttpError(error: unknown): boolean {
  if (!(error instanceof HttpErrorResponse)) {
    return false;
  }
  if (SUBSCRIPTION_EXPIRED_CODES.has(readCode(error))) {
    return true;
  }
  if (error.status === 402) {
    return true;
  }
  return getSubscriptionExpiredMessage(error) !== null;
}

/** Alias for interceptors and guards (subscription / license expiry HTTP errors). */
export const isSubscriptionError = isSubscriptionExpiredHttpError;
