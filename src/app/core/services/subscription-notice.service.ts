import { Injectable, inject } from '@angular/core';
import { NzModalService } from 'ng-zorro-antd/modal';
import { TranslateService } from '@ngx-translate/core';

/**
 * Shows subscription-expiry messaging in a modal (no full-page redirect).
 * Dedupes to one modal per session until logout clears the flag.
 * Works on the login route (root injector); high z-index keeps the dialog above the login UI.
 */
@Injectable({ providedIn: 'root' })
export class SubscriptionNoticeService {
  /** CDK overlay pane + modal wrap; must be above mask or the dimmer covers the dialog. */
  private static readonly MODAL_Z_INDEX = 1100;
  private static readonly MASK_Z_INDEX = SubscriptionNoticeService.MODAL_Z_INDEX - 1;

  private readonly modal = inject(NzModalService);
  private readonly translate = inject(TranslateService);

  private shownThisSession = false;

  resetSession(): void {
    this.shownThisSession = false;
  }

  /**
   * Opens the subscription notice if not already shown this session.
   * Safe when the user is not fully authenticated (e.g. blocked at login).
   * @returns true if a new modal was opened
   */
  showExpiredNotice(message?: string | null): boolean {
    if (this.shownThisSession) {
      return false;
    }
    this.shownThisSession = true;
    const content =
      message?.trim() || this.translate.instant('SUBSCRIPTION.EXPIRED_MESSAGE');
    this.modal.warning({
      nzTitle: this.translate.instant('SUBSCRIPTION.EXPIRED_TITLE'),
      nzContent: content,
      nzOkText: this.translate.instant('COMMON.OK'),
      nzCentered: true,
      nzMaskClosable: true,
      nzZIndex: SubscriptionNoticeService.MODAL_Z_INDEX,
      nzMaskStyle: { 'z-index': String(SubscriptionNoticeService.MASK_Z_INDEX) },
    });
    return true;
  }

  /**
   * @deprecated Use {@link showExpiredNotice} — same behavior.
   */
  tryShowExpiredNotice(message?: string | null): boolean {
    return this.showExpiredNotice(message);
  }
}
