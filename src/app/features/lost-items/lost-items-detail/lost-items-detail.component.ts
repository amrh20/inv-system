import { DatePipe, NgClass } from '@angular/common';
import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzTableModule } from 'ng-zorro-antd/table';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { LucideAngularModule } from 'lucide-angular';
import { ArrowLeft, CheckCircle2, Clock, PackageX, XCircle } from 'lucide-angular';
import { HasPermissionDirective } from '../../../core/directives/has-permission.directive';
import { AuthService } from '../../../core/services/auth.service';
import { ConfirmationService } from '../../../core/services/confirmation.service';
import { ReturnsWorkflowApproveModalComponent } from '../../../shared/components/returns-workflow-approve-modal/returns-workflow-approve-modal.component';
import { ReturnsWorkflowTimelineComponent } from '../../../shared/components/returns-workflow-timeline/returns-workflow-timeline.component';
import type { ReturnsAccountabilityType } from '../../../shared/models/returns-accountability.model';
import {
  pendingApprovalStepFromContext,
  requiredRoleCodeFromStep,
  userMatchesCurrentApprovalChainStep,
  userMatchesNextWorkflowStep,
  WORKFLOW_PERMISSION_APPROVE_LOST,
} from '../../../shared/utils/returns-workflow.helpers';
import type { LostDetail, LostWorkflowStatus } from '../models/lost-items.model';
import { LostItemsService } from '../services/lost-items.service';

@Component({
  selector: 'app-lost-items-detail',
  standalone: true,
  providers: [ConfirmationService],
  imports: [
    DatePipe,
    NgClass,
    FormsModule,
    RouterLink,
    NzAlertModule,
    NzButtonModule,
    NzInputModule,
    NzModalModule,
    NzTableModule,
    TranslatePipe,
    LucideAngularModule,
    HasPermissionDirective,
    ReturnsWorkflowTimelineComponent,
    ReturnsWorkflowApproveModalComponent,
  ],
  templateUrl: './lost-items-detail.component.html',
  styleUrl: './lost-items-detail.component.scss',
})
export class LostItemsDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly api = inject(LostItemsService);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly auth = inject(AuthService);
  private readonly message = inject(NzMessageService);
  private readonly confirmation = inject(ConfirmationService);

  readonly lucideBack = ArrowLeft;
  readonly lucideClock = Clock;
  readonly lucidePackageX = PackageX;
  readonly lucideCheck = CheckCircle2;
  readonly lucideX = XCircle;

  readonly doc = signal<LostDetail | null>(null);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly actionBusy = signal(false);
  readonly returnsWorkflowOpen = signal(false);
  readonly returnsWorkflowSubmitting = signal(false);
  readonly rejectModalOpen = signal(false);
  readonly rejectComment = signal('');

  readonly permApproveLost = WORKFLOW_PERMISSION_APPROVE_LOST;

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.error.set(this.translate.instant('LOST_ITEMS.DETAIL.LOAD_ERROR'));
      this.loading.set(false);
      return;
    }
    this.fetch(id);
  }

  back(): void {
    void this.router.navigate(['/lost-items']);
  }

  private fetch(id: string): void {
    this.loading.set(true);
    this.error.set('');
    this.api
      .getById(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (d) => {
          this.doc.set(d);
          this.loading.set(false);
        },
        error: () => {
          this.error.set(this.translate.instant('LOST_ITEMS.DETAIL.LOAD_ERROR'));
          this.loading.set(false);
        },
      });
  }

  userName(u: { firstName: string; lastName: string } | null | undefined): string {
    if (!u) return '—';
    return `${u.firstName} ${u.lastName}`.trim();
  }

  num(v: string | number | null | undefined): number {
    return Number(v ?? 0);
  }

  statusBadgeClass(status: LostWorkflowStatus | string): string {
    switch (status) {
      case 'DRAFT':
        return 'pending';
      case 'DEPT_APPROVED':
      case 'COST_CONTROL_APPROVED':
      case 'FINANCE_APPROVED':
        return 'warning';
      case 'APPROVED':
        return 'active';
      default:
        return 'pending';
    }
  }

  sourceLabel(d: LostDetail): string {
    return d.sourceType === 'GET_PASS_RETURN'
      ? this.translate.instant('LOST_ITEMS.LIST.SOURCE_FROM_RETURN')
      : this.translate.instant('LOST_ITEMS.LIST.SOURCE_INTERNAL');
  }

  linesForTable(d: LostDetail): NonNullable<LostDetail['lines']> {
    return d.lines ?? [];
  }

  private hasApprovalRequestChain(d: LostDetail): boolean {
    const steps = d.approvalRequests?.[0]?.steps;
    return Array.isArray(steps) && steps.length > 0;
  }

  /** User may advance workflow (permission + role for current step). */
  canTakeAction(): boolean {
    const d = this.doc();
    const u = this.auth.currentUser();
    if (!d || !u) return false;
    if (!this.auth.hasPermission(WORKFLOW_PERMISSION_APPROVE_LOST)) return false;
    if (d.status === 'APPROVED') return false;

    if (this.hasApprovalRequestChain(d)) {
      const step = pendingApprovalStepFromContext(d);
      if (!step) return false;
      return userMatchesCurrentApprovalChainStep(u.role, requiredRoleCodeFromStep(step), d);
    }

    if (d.sourceType !== 'INTERNAL') return false;
    return userMatchesNextWorkflowStep(this.auth.userRole(), d.status);
  }

  /** Unified `/approve` + modal (get-pass returns, or any lost doc with an approval chain). */
  shouldUseUnifiedLostApprovalUi(d: LostDetail): boolean {
    return d.sourceType === 'GET_PASS_RETURN' || this.hasApprovalRequestChain(d);
  }

  openReturnsWorkflowApprove(): void {
    this.returnsWorkflowOpen.set(true);
  }

  closeReturnsWorkflow(): void {
    if (this.returnsWorkflowSubmitting()) return;
    this.returnsWorkflowOpen.set(false);
  }

  onReturnsWorkflowSubmitted(accountability: ReturnsAccountabilityType): void {
    const d = this.doc();
    const id = d?.id;
    if (!id || !d) return;
    this.returnsWorkflowSubmitting.set(true);
    this.api
      .approveAtCurrentStep(
        id,
        {
          sourceType: d.sourceType,
          status: d.status,
          approvalRequests: d.approvalRequests,
        },
        { accountability },
      )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.returnsWorkflowOpen.set(false);
          this.returnsWorkflowSubmitting.set(false);
          this.message.success(this.translate.instant('LOST_ITEMS.DETAIL.ACTION_OK'));
          this.fetch(id);
        },
        error: (e: Error) => {
          this.returnsWorkflowSubmitting.set(false);
          this.message.error(e.message || this.translate.instant('LOST_ITEMS.DETAIL.ACTION_FAIL'));
        },
      });
  }

  openRejectModal(): void {
    this.rejectComment.set('');
    this.rejectModalOpen.set(true);
  }

  confirmReject(): void {
    const id = this.doc()?.id;
    const comment = this.rejectComment().trim();
    if (!id) return;
    if (!comment) {
      this.message.warning(this.translate.instant('LOST_ITEMS.DETAIL.REJECT_REASON_REQUIRED'));
      return;
    }
    this.actionBusy.set(true);
    this.api
      .rejectWorkflowStep(id, comment)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (d) => {
          this.doc.set(d);
          this.rejectModalOpen.set(false);
          this.actionBusy.set(false);
          this.message.success(this.translate.instant('LOST_ITEMS.DETAIL.ACTION_OK'));
        },
        error: (e: Error) => {
          this.actionBusy.set(false);
          this.message.error(e.message || this.translate.instant('LOST_ITEMS.DETAIL.ACTION_FAIL'));
        },
      });
  }

  confirmApproveInternal(): void {
    const d = this.doc();
    if (!d?.id) return;
    this.confirmation
      .confirm({
        title: this.translate.instant('LOST_ITEMS.LIST.APPROVE'),
        message: this.translate.instant('LOST_ITEMS.DETAIL.CONFIRM_APPROVE_MSG'),
        confirmText: this.translate.instant('COMMON.CONFIRM'),
        cancelText: this.translate.instant('COMMON.CANCEL'),
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((ok) => {
        if (!ok) return;
        this.actionBusy.set(true);
        const req$ = this.api.approveAtCurrentStep(d.id, {
          sourceType: d.sourceType,
          status: d.status,
          approvalRequests: d.approvalRequests,
        });
        req$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
          next: () => {
            this.actionBusy.set(false);
            this.message.success(this.translate.instant('LOST_ITEMS.LIST.APPROVE_SUCCESS'));
            this.fetch(d.id);
          },
          error: (e: Error) => {
            this.actionBusy.set(false);
            this.message.error(e.message || this.translate.instant('LOST_ITEMS.LIST.APPROVE_ERROR'));
          },
        });
      });
  }
}
