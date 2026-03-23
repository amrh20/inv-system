import { DatePipe, DecimalPipe, NgClass } from '@angular/common';
import {
  Component,
  DestroyRef,
  inject,
  OnInit,
  signal,
  computed,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzTableModule } from 'ng-zorro-antd/table';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { NzMessageService } from 'ng-zorro-antd/message';
import type { UserRole } from '../../../core/models/enums';
import { AuthService } from '../../../core/services/auth.service';
import { ConfirmationService } from '../../../core/services/confirmation.service';
import { environment } from '../../../../environments/environment';
import type { GrnDetail } from '../models/grn.model';
import { GrnService } from '../services/grn.service';

const FINANCE_ROLES: UserRole[] = ['FINANCE_MANAGER', 'COST_CONTROL', 'ADMIN', 'SUPER_ADMIN'];

@Component({
  selector: 'app-grn-detail',
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
    NzModalModule,
    NzTableModule,
    TranslatePipe,
  ],
  templateUrl: './grn-detail.component.html',
  styleUrl: './grn-detail.component.scss',
})
export class GrnDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly grnApi = inject(GrnService);
  private readonly auth = inject(AuthService);
  private readonly confirmation = inject(ConfirmationService);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);

  readonly grn = signal<GrnDetail | null>(null);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly actionError = signal('');
  readonly rejectReason = signal('');
  readonly showReject = signal(false);
  readonly acting = signal(false);

  readonly isFinance = computed(() => {
    const role = this.auth.currentUser()?.role;
    return role ? FINANCE_ROLES.includes(role) : false;
  });

  readonly mappedCount = computed(() => {
    const g = this.grn();
    return g?.lines?.filter((l) => l.isMapped).length ?? 0;
  });

  readonly unmappedCount = computed(() => {
    const g = this.grn();
    const n = g?.lines?.length ?? 0;
    return n - this.mappedCount();
  });

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.error.set(this.translate.instant('GRN.DETAIL.NOT_FOUND'));
      this.loading.set(false);
      return;
    }
    this.fetch(id);
  }

  back(): void {
    this.router.navigate(['/grn']);
  }

  invoiceHref(pdfAttachmentUrl: string): string {
    const base = environment.apiUrl.replace(/\/api\/?$/, '');
    const normalized = pdfAttachmentUrl.replace(/\\/g, '/');
    const filename = normalized.split('/').pop() ?? '';
    const subfolder = normalized.includes('/invoices/') ? '/invoices/' : '/';
    return `${base}/uploads/grn${subfolder}${filename}`;
  }

  statusClass(status: GrnDetail['status']): string {
    switch (status) {
      case 'DRAFT':
        return 'draft';
      case 'VALIDATED':
        return 'processing';
      case 'PENDING_APPROVAL':
        return 'pending';
      case 'APPROVED':
        return 'success';
      case 'POSTED':
        return 'posted';
      case 'REJECTED':
        return 'rejected';
      default:
        return 'pending';
    }
  }

  validateGrn(): void {
    const id = this.grn()?.id;
    if (!id) return;
    this.confirmation
      .confirm({
        title: this.translate.instant('GRN.DETAIL.CONFIRM_VALIDATE_TITLE'),
        message: this.translate.instant('GRN.DETAIL.CONFIRM_VALIDATE_MSG'),
        confirmText: this.translate.instant('COMMON.CONFIRM'),
        cancelText: this.translate.instant('COMMON.CANCEL'),
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((ok) => {
        if (ok) this.runAction(id, 'validate');
      });
  }

  submitForApproval(): void {
    const id = this.grn()?.id;
    if (!id) return;
    this.confirmation
      .confirm({
        title: this.translate.instant('GRN.DETAIL.CONFIRM_SUBMIT_TITLE'),
        message: this.translate.instant('GRN.DETAIL.CONFIRM_SUBMIT_MSG'),
        confirmText: this.translate.instant('COMMON.CONFIRM'),
        cancelText: this.translate.instant('COMMON.CANCEL'),
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((ok) => {
        if (ok) this.runAction(id, 'submit');
      });
  }

  approve(): void {
    const id = this.grn()?.id;
    if (!id) return;
    this.confirmation
      .confirm({
        title: this.translate.instant('GRN.DETAIL.CONFIRM_APPROVE_TITLE'),
        message: this.translate.instant('GRN.DETAIL.CONFIRM_APPROVE_MSG'),
        confirmText: this.translate.instant('COMMON.CONFIRM'),
        cancelText: this.translate.instant('COMMON.CANCEL'),
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((ok) => {
        if (ok) this.runAction(id, 'approve', { comment: 'Approved' });
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
    const id = this.grn()?.id;
    const reason = this.rejectReason().trim();
    if (!id || !reason) return;
    this.runAction(id, 'reject', { reason });
    this.showReject.set(false);
  }

  postToLedger(): void {
    const id = this.grn()?.id;
    if (!id) return;
    this.confirmation
      .confirm({
        title: this.translate.instant('GRN.DETAIL.CONFIRM_POST_TITLE'),
        message: this.translate.instant('GRN.DETAIL.CONFIRM_POST_MSG'),
        confirmText: this.translate.instant('GRN.DETAIL.CONFIRM_POST_OK'),
        cancelText: this.translate.instant('COMMON.CANCEL'),
        confirmDanger: true,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((ok) => {
        if (ok) this.runAction(id, 'post');
      });
  }

  private fetch(id: string): void {
    this.loading.set(true);
    this.error.set('');
    this.grnApi
      .getById(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (g) => {
          this.grn.set(g);
          this.loading.set(false);
        },
        error: () => {
          this.error.set(this.translate.instant('GRN.DETAIL.LOAD_ERROR'));
          this.loading.set(false);
        },
      });
  }

  private runAction(
    id: string,
    endpoint: 'validate' | 'submit' | 'approve' | 'reject' | 'post',
    body?: unknown,
  ): void {
    this.acting.set(true);
    this.actionError.set('');
    this.grnApi
      .postAction(id, endpoint, body)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.acting.set(false);
          this.message.success(this.translate.instant('GRN.DETAIL.ACTION_OK'));
          this.fetch(id);
        },
        error: (err: { error?: { message?: string } }) => {
          this.acting.set(false);
          this.actionError.set(
            err?.error?.message ?? this.translate.instant('GRN.DETAIL.ACTION_FAIL'),
          );
        },
      });
  }
}
