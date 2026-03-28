import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  effect,
  inject,
} from '@angular/core';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { TranslatePipe } from '@ngx-translate/core';
import { LucideAngularModule, AlertTriangle } from 'lucide-angular';
import { SubscriptionNoticeService } from '../../../core/services/subscription-notice.service';

@Component({
  selector: 'app-subscription-expired-overlay',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NzButtonModule, TranslatePipe, LucideAngularModule],
  templateUrl: './subscription-expired-overlay.component.html',
  styleUrl: './subscription-expired-overlay.component.scss',
})
export class SubscriptionExpiredOverlayComponent {
  readonly subscriptionNotice = inject(SubscriptionNoticeService);
  private readonly destroyRef = inject(DestroyRef);

  readonly lucideAlertTriangle = AlertTriangle;

  constructor() {
    effect(() => {
      const open = this.subscriptionNotice.expiredPayload() !== null;
      document.body.style.overflow = open ? 'hidden' : '';
    });
    this.destroyRef.onDestroy(() => {
      document.body.style.overflow = '';
    });
  }

  onBackdropClick(): void {
    this.subscriptionNotice.dismissExpiredOverlay();
  }

  close(): void {
    this.subscriptionNotice.dismissExpiredOverlay();
  }
}
