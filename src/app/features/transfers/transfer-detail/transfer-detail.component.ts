import { DatePipe, DecimalPipe, NgClass } from '@angular/common';
import {
  Component,
  computed,
  DestroyRef,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzTableModule } from 'ng-zorro-antd/table';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { LucideAngularModule } from 'lucide-angular';
import {
  ArrowLeft,
  ArrowRightLeft,
  Check,
  Package,
  Truck,
  X,
} from 'lucide-angular';
import type { TransferStatus } from '../../../core/models/enums';
import { HasPermissionDirective } from '../../../core/directives/has-permission.directive';
import { AuthService } from '../../../core/services/auth.service';
import { ConfirmationService } from '../../../core/services/confirmation.service';
import type { TransferDetail } from '../models/transfer.model';
import { TransferService } from '../services/transfer.service';

@Component({
  selector: 'app-transfer-detail',
  standalone: true,
  providers: [ConfirmationService],
  imports: [
    DatePipe,
    DecimalPipe,
    NgClass,
    FormsModule,
    NzAlertModule,
    NzButtonModule,
    NzInputModule,
    NzTableModule,
    TranslatePipe,
    LucideAngularModule,
    HasPermissionDirective,
  ],
  templateUrl: './transfer-detail.component.html',
  styleUrl: './transfer-detail.component.scss',
})
export class TransferDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly api = inject(TransferService);
  private readonly auth = inject(AuthService);
  private readonly confirmation = inject(ConfirmationService);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);

  readonly lucideBack = ArrowLeft;
  readonly lucideArrows = ArrowRightLeft;
  readonly lucideCheck = Check;
  readonly lucideX = X;
  readonly lucideTruck = Truck;
  readonly lucidePackage = Package;

  readonly trf = signal<TransferDetail | null>(null);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly actionError = signal('');
  readonly rejectReason = signal('');
  readonly showReject = signal(false);
  readonly acting = signal(false);

  readonly isManager = computed(() => {
    return this.auth.hasPermission('TRANSFER_APPROVE');
  });

  readonly isStorekeeper = computed(() => {
    return this.auth.hasPermission('TRANSFER_DISPATCH_RECEIVE');
  });

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.error.set(this.translate.instant('TRANSFER.DETAIL.NOT_FOUND'));
      this.loading.set(false);
      return;
    }
    this.fetch(id);
  }

  back(): void {
    this.router.navigate(['/transfers']);
  }

  edit(): void {
    const id = this.trf()?.id;
    if (!id) return;
    this.router.navigate(['/transfers', id, 'edit']);
  }

  statusClass(status: TransferStatus): string {
    switch (status) {
      case 'DRAFT':
        return 'pending';
      case 'SUBMITTED':
        return 'pending';
      case 'APPROVED':
        return 'processing';
      case 'IN_TRANSIT':
        return 'low-stock';
      case 'RECEIVED':
      case 'CLOSED':
        return 'success';
      case 'REJECTED':
        return 'rejected';
      default:
        return 'pending';
    }
  }

  num(v: string | number | null | undefined): number {
    return Number(v ?? 0);
  }

  submit(): void {
    const id = this.trf()?.id;
    if (!id) return;
    this.confirmation
      .confirm({
        title: this.translate.instant('TRANSFER.DETAIL.CONFIRM_SUBMIT_TITLE'),
        message: this.translate.instant('TRANSFER.DETAIL.CONFIRM_SUBMIT_MSG'),
        confirmText: this.translate.instant('COMMON.CONFIRM'),
        cancelText: this.translate.instant('COMMON.CANCEL'),
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((ok) => {
        if (ok) this.runAction(id, 'submit');
      });
  }

  approve(): void {
    const id = this.trf()?.id;
    if (!id) return;
    this.confirmation
      .confirm({
        title: this.translate.instant('TRANSFER.DETAIL.CONFIRM_APPROVE_TITLE'),
        message: this.translate.instant('TRANSFER.DETAIL.CONFIRM_APPROVE_MSG'),
        confirmText: this.translate.instant('COMMON.CONFIRM'),
        cancelText: this.translate.instant('COMMON.CANCEL'),
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((ok) => {
        if (ok) this.runAction(id, 'approve');
      });
  }

  openReject(): void {
    this.showReject.set(true);
    this.rejectReason.set('');
    this.actionError.set('');
  }

  cancelReject(): void {
    this.showReject.set(false);
  }

  confirmReject(): void {
    const id = this.trf()?.id;
    const reason = this.rejectReason().trim();
    if (!id || !reason) return;
    this.runAction(id, 'reject', { reason });
    this.showReject.set(false);
  }

  dispatch(): void {
    const id = this.trf()?.id;
    if (!id) return;
    this.confirmation
      .confirm({
        title: this.translate.instant('TRANSFER.DETAIL.CONFIRM_DISPATCH_TITLE'),
        message: this.translate.instant('TRANSFER.DETAIL.CONFIRM_DISPATCH_MSG'),
        confirmText: this.translate.instant('COMMON.CONFIRM'),
        cancelText: this.translate.instant('COMMON.CANCEL'),
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((ok) => {
        if (ok) this.runAction(id, 'dispatch');
      });
  }

  receive(): void {
    const id = this.trf()?.id;
    if (!id) return;
    this.confirmation
      .confirm({
        title: this.translate.instant('TRANSFER.DETAIL.CONFIRM_RECEIVE_TITLE'),
        message: this.translate.instant('TRANSFER.DETAIL.CONFIRM_RECEIVE_MSG'),
        confirmText: this.translate.instant('COMMON.CONFIRM'),
        cancelText: this.translate.instant('COMMON.CANCEL'),
        confirmDanger: true,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((ok) => {
        if (ok) this.runAction(id, 'receive', { receivedLines: [] });
      });
  }

  deleteDraft(): void {
    const id = this.trf()?.id;
    if (!id) return;
    this.confirmation
      .confirm({
        title: this.translate.instant('TRANSFER.DETAIL.CONFIRM_DELETE_TITLE'),
        message: this.translate.instant('TRANSFER.DETAIL.CONFIRM_DELETE_MSG'),
        confirmText: this.translate.instant('COMMON.DELETE'),
        cancelText: this.translate.instant('COMMON.CANCEL'),
        confirmDanger: true,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((ok) => {
        if (!ok) return;
        this.acting.set(true);
        this.actionError.set('');
        this.api
          .delete(id)
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe({
            next: () => {
              this.acting.set(false);
              this.message.success(this.translate.instant('TRANSFER.DETAIL.DELETE_OK'));
              this.router.navigate(['/transfers']);
            },
            error: (err: { error?: { message?: string } }) => {
              this.acting.set(false);
              this.actionError.set(
                err?.error?.message ?? this.translate.instant('TRANSFER.DETAIL.DELETE_FAIL'),
              );
            },
          });
      });
  }

  private fetch(id: string): void {
    this.loading.set(true);
    this.error.set('');
    this.api
      .getById(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (t) => {
          this.trf.set(t);
          this.loading.set(false);
        },
        error: () => {
          this.error.set(this.translate.instant('TRANSFER.DETAIL.LOAD_ERROR'));
          this.loading.set(false);
        },
      });
  }

  private runAction(
    id: string,
    endpoint: 'submit' | 'approve' | 'reject' | 'dispatch' | 'receive',
    body?: unknown,
  ): void {
    this.acting.set(true);
    this.actionError.set('');
    this.api
      .postAction(id, endpoint, body)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.acting.set(false);
          this.message.success(this.translate.instant('TRANSFER.DETAIL.ACTION_OK'));
          this.fetch(id);
        },
        error: (err: { error?: { message?: string } }) => {
          this.acting.set(false);
          this.actionError.set(
            err?.error?.message ?? this.translate.instant('TRANSFER.DETAIL.ACTION_FAIL'),
          );
        },
      });
  }
}
