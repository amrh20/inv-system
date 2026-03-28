import { Injectable, signal } from '@angular/core';

export interface SubscriptionExpiredPayload {
  /** When null, UI shows translated SUBSCRIPTION.EXPIRED_MESSAGE. */
  customMessage: string | null;
}

/**
 * Subscription expiry UI via root-level overlay (see app-subscription-expired-overlay).
 * Avoids NzModal/CDK backdrop stacking issues on the login route.
 * Dedupes to one notice per session until logout clears the flag.
 */
@Injectable({ providedIn: 'root' })
export class SubscriptionNoticeService {
  private shownThisSession = false;

  private readonly _expiredPayload = signal<SubscriptionExpiredPayload | null>(null);
  readonly expiredPayload = this._expiredPayload.asReadonly();

  resetSession(): void {
    this.shownThisSession = false;
    this._expiredPayload.set(null);
  }

  /**
   * Shows the overlay if not already shown this session.
   * @returns true if the overlay was opened
   */
  showExpiredNotice(message?: string | null): boolean {
    if (this.shownThisSession) {
      return false;
    }
    this.shownThisSession = true;
    const trimmed = message?.trim();
    this._expiredPayload.set({
      customMessage: trimmed && trimmed.length > 0 ? trimmed : null,
    });
    return true;
  }

  dismissExpiredOverlay(): void {
    this._expiredPayload.set(null);
  }

  /**
   * @deprecated Use {@link showExpiredNotice} — same behavior.
   */
  tryShowExpiredNotice(message?: string | null): boolean {
    return this.showExpiredNotice(message);
  }
}
