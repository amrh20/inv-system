import { DatePipe, NgClass } from '@angular/common';
import {
  Component,
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
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule, NzModalService } from 'ng-zorro-antd/modal';
import { NzRadioModule } from 'ng-zorro-antd/radio';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzStepsModule } from 'ng-zorro-antd/steps';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { Observable } from 'rxjs';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { LucideAngularModule } from 'lucide-angular';
import { ArrowLeft, CheckCircle2, Package, Printer, XCircle } from 'lucide-angular';
import type { GetPassStatus, GetPassType } from '../../../core/models/enums';
import { HasPermissionDirective } from '../../../core/directives/has-permission.directive';
import { AuthService } from '../../../core/services/auth.service';
import { ConfirmationService } from '../../../core/services/confirmation.service';
import type { GetPassDetail, GetPassReturnLinePayload, GetPassUserRef } from '../models/get-pass.model';
import { GetPassService } from '../services/get-pass.service';

type ReturnConditionFlag = 'NONE' | 'LOST' | 'DAMAGED';

interface ReturnDraft {
  lineId: string;
  itemName: string;
  maxReturn: number;
  /** Quantity in good condition (restores stock). */
  qtyGood: number;
  /** Lost or damaged quantity when flag is LOST or DAMAGED. */
  qtyAffected: number;
  returnFlag: ReturnConditionFlag;
  conditionIn: string;
}

@Component({
  selector: 'app-get-pass-detail',
  standalone: true,
  providers: [DatePipe, ConfirmationService],
  imports: [
    DatePipe,
    NgClass,
    FormsModule,
    NzAlertModule,
    NzButtonModule,
    NzInputModule,
    NzInputNumberModule,
    NzModalModule,
    NzRadioModule,
    NzSelectModule,
    NzStepsModule,
    NzTableModule,
    NzTagModule,
    TranslatePipe,
    LucideAngularModule,
    HasPermissionDirective,
  ],
  templateUrl: './get-pass-detail.component.html',
  styleUrl: './get-pass-detail.component.scss',
})
export class GetPassDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly api = inject(GetPassService);
  private readonly auth = inject(AuthService);
  private readonly confirmation = inject(ConfirmationService);
  private readonly modal = inject(NzModalService);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly datePipe = inject(DatePipe);

  readonly lucideBack = ArrowLeft;
  readonly lucidePkg = Package;
  readonly lucidePrint = Printer;
  readonly lucideCheck = CheckCircle2;
  readonly lucideX = XCircle;

  readonly data = signal<GetPassDetail | null>(null);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly actionBusy = signal(false);

  readonly notesOpen = signal(false);
  readonly notesAction = signal<'APPROVE' | 'REJECT' | null>(null);
  readonly actionNotes = signal('');

  readonly returnOpen = signal(false);
  readonly returnLines = signal<ReturnDraft[]>([]);
  readonly returnGlobalNotes = signal('');

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.error.set(this.translate.instant('GET_PASS.DETAIL.NOT_FOUND'));
      this.loading.set(false);
      return;
    }
    this.load(id);
  }

  back(): void {
    this.router.navigate(['/get-passes']);
  }

  edit(): void {
    const id = this.data()?.id;
    if (!id) return;
    this.router.navigate(['/get-passes', id, 'edit']);
  }

  num(v: string | number | null | undefined): number {
    return Number(v ?? 0);
  }

  /** API may omit `lines`; iterating undefined throws and blanks the routed view. */
  private normalizeDetail(d: GetPassDetail): GetPassDetail {
    return { ...d, lines: d.lines ?? [] };
  }

  load(id: string): void {
    this.loading.set(true);
    this.error.set('');
    this.api
      .getById(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (d) => {
          const normalized = this.normalizeDetail(d);
          this.data.set(normalized);
          this.initReturnDrafts(normalized);
          this.loading.set(false);
        },
        error: () => {
          this.error.set(this.translate.instant('GET_PASS.DETAIL.LOAD_ERROR'));
          this.loading.set(false);
        },
      });
  }

  private initReturnDrafts(d: GetPassDetail): void {
    if (!['OUT', 'PARTIALLY_RETURNED'].includes(d.status) || d.transferType === 'PERMANENT') {
      this.returnLines.set([]);
      return;
    }
    const rows: ReturnDraft[] = [];
    for (const line of d.lines ?? []) {
      const max = this.num(line.qty) - this.num(line.qtyReturned);
      if (max <= 0) continue;
      rows.push({
        lineId: line.id,
        itemName: line.item?.name ?? line.itemId,
        maxReturn: max,
        qtyGood: 0,
        qtyAffected: 0,
        returnFlag: 'NONE',
        conditionIn: '',
      });
    }
    this.returnLines.set(rows);
  }

  statusClass(s: GetPassStatus): string {
    switch (s) {
      case 'DRAFT':
      case 'PENDING_DEPT':
      case 'PENDING_COST_CONTROL':
      case 'PENDING_FINANCE':
      case 'PENDING_GM':
      case 'PENDING_SECURITY':
        return 'pending';
      case 'APPROVED':
      case 'OUT':
        return 'processing';
      case 'RECEIVED_AT_DESTINATION':
        return 'success';
      case 'PARTIALLY_RETURNED':
        return 'low-stock';
      case 'RETURNED':
      case 'CLOSED':
        return 'success';
      case 'REJECTED':
        return 'rejected';
      default:
        return 'pending';
    }
  }

  /** Issuing hotel (this pass’s stock / workflow). */
  isViewerIssuerTenant(): boolean {
    const tid = this.auth.currentTenantId();
    const issuerId = this.data()?.tenant?.id ?? null;
    return !!tid && !!issuerId && tid === issuerId;
  }

  canSubmit(): boolean {
    const d = this.data();
    return !!d && d.status === 'DRAFT' && this.isViewerIssuerTenant();
  }

  canEdit(): boolean {
    return this.canSubmit();
  }

  canDelete(): boolean {
    const d = this.data();
    if (!d) return false;
    return (d.status === 'DRAFT' || d.status === 'REJECTED') && this.isViewerIssuerTenant();
  }

  /** ADMIN / SUPER_ADMIN may act at any workflow step (backend still enforces). */
  isAdminBypass(): boolean {
    return this.auth.hasRole('ADMIN', 'SUPER_ADMIN');
  }

  showPendingDeptActions(): boolean {
    const d = this.data();
    if (this.isViewerTargetTenant()) return false;
    if (!d || d.status !== 'PENDING_DEPT') return false;
    return (
      this.isAdminBypass() ||
      this.auth.hasRole('DEPT_MANAGER') ||
      this.auth.hasPermission('GET_PASS_APPROVE')
    );
  }

  showCostControlVerifyActions(): boolean {
    const d = this.data();
    if (this.isViewerTargetTenant()) return false;
    if (!d || d.status !== 'PENDING_COST_CONTROL') return false;
    return this.isAdminBypass() || this.auth.hasRole('COST_CONTROL');
  }

  showFinanceSignActions(): boolean {
    const d = this.data();
    if (this.isViewerTargetTenant()) return false;
    if (!d || d.status !== 'PENDING_FINANCE') return false;
    return this.isAdminBypass() || this.auth.hasRole('FINANCE_MANAGER');
  }

  showGmAuthorizeActions(): boolean {
    const d = this.data();
    if (this.isViewerTargetTenant()) return false;
    if (!d || d.status !== 'PENDING_GM') return false;
    return this.isAdminBypass() || this.auth.hasRole('GENERAL_MANAGER');
  }

  /** Security clearance (after GM); ADMIN may act here for support. */
  showSecurityApproveActions(): boolean {
    const d = this.data();
    if (this.isViewerTargetTenant()) return false;
    if (!d || d.status !== 'PENDING_SECURITY') return false;
    return this.isAdminBypass() || this.auth.hasRole('SECURITY');
  }

  /** True when any workflow approve/reject pair is shown and the user is acting via admin role. */
  showAdminActionLabel(): boolean {
    if (!this.isAdminBypass()) return false;
    return (
      this.showPendingDeptActions() ||
      this.showCostControlVerifyActions() ||
      this.showFinanceSignActions() ||
      this.showGmAuthorizeActions() ||
      this.showSecurityApproveActions()
    );
  }

  /** Pass is waiting on one of the approval stages (admin sees every approve action, one enabled). */
  isWorkflowApprovalPending(): boolean {
    const d = this.data();
    if (!d) return false;
    return (
      d.status === 'PENDING_DEPT' ||
      d.status === 'PENDING_COST_CONTROL' ||
      d.status === 'PENDING_FINANCE' ||
      d.status === 'PENDING_GM' ||
      d.status === 'PENDING_SECURITY'
    );
  }

  canRejectWorkflow(): boolean {
    return (
      this.showPendingDeptActions() ||
      this.showCostControlVerifyActions() ||
      this.showFinanceSignActions() ||
      this.showGmAuthorizeActions() ||
      this.showSecurityApproveActions()
    );
  }

  /**
   * Visible workflow steps (no Draft): 0 Dept → 1 CC → 2 Finance → 3 GM → 4 Security → 5 Approved.
   */
  workflowActiveIndex(status: GetPassStatus): number {
    switch (status) {
      case 'DRAFT':
        return 0;
      case 'PENDING_DEPT':
        return 0;
      case 'PENDING_COST_CONTROL':
        return 1;
      case 'PENDING_FINANCE':
        return 2;
      case 'PENDING_GM':
        return 3;
      case 'PENDING_SECURITY':
        return 4;
      case 'APPROVED':
      case 'OUT':
      case 'RECEIVED_AT_DESTINATION':
      case 'PARTIALLY_RETURNED':
      case 'RETURNED':
      case 'CLOSED':
        return 5;
      default:
        return 0;
    }
  }

  private rejectionErrorStepIndex(d: GetPassDetail): number {
    if (!d.deptApprovedAt) return 0;
    if (!d.costControlApprovedAt) return 1;
    if (!d.financeApprovedAt) return 2;
    if (!d.gmApprovedAt) return 3;
    if (!d.securityApprovedAt) return 4;
    return 5;
  }

  workflowStepStatuses(d: GetPassDetail): Array<'wait' | 'process' | 'finish' | 'error'> {
    const terminal: GetPassStatus[] = [
      'APPROVED',
      'OUT',
      'RECEIVED_AT_DESTINATION',
      'PARTIALLY_RETURNED',
      'RETURNED',
      'CLOSED',
    ];
    if (terminal.includes(d.status)) {
      return ['finish', 'finish', 'finish', 'finish', 'finish', 'finish'];
    }
    if (d.status === 'REJECTED') {
      const err = this.rejectionErrorStepIndex(d);
      return [0, 1, 2, 3, 4, 5].map((i) => {
        if (i < err) return 'finish';
        if (i === err) return 'error';
        return 'wait';
      }) as Array<'wait' | 'process' | 'finish' | 'error'>;
    }
    const cur = this.workflowActiveIndex(d.status);
    return [0, 1, 2, 3, 4, 5].map((i) => {
      if (i < cur) return 'finish';
      if (i === cur) return 'process';
      return 'wait';
    }) as Array<'wait' | 'process' | 'finish' | 'error'>;
  }

  workflowNzCurrent(d: GetPassDetail): number {
    const st = this.workflowStepStatuses(d);
    const proc = st.indexOf('process');
    if (proc >= 0) return proc;
    const err = st.indexOf('error');
    if (err >= 0) return err;
    return 5;
  }

  workflowStepStatus(d: GetPassDetail, index: number): 'wait' | 'process' | 'finish' | 'error' {
    return this.workflowStepStatuses(d)[index] ?? 'wait';
  }

  /** Approve confirmation modal title by current workflow step. */
  approveNotesModalTitleKey(): string {
    const d = this.data();
    if (!d) return 'GET_PASS.DETAIL.NOTES_APPROVE_TITLE';
    switch (d.status) {
      case 'PENDING_DEPT':
        return 'GET_PASS.DETAIL.NOTES_APPROVE_DEPT_TITLE';
      case 'PENDING_COST_CONTROL':
        return 'GET_PASS.DETAIL.NOTES_VERIFY_CC_TITLE';
      case 'PENDING_FINANCE':
        return 'GET_PASS.DETAIL.NOTES_SIGN_FINANCE_TITLE';
      case 'PENDING_GM':
        return 'GET_PASS.DETAIL.NOTES_AUTHORIZE_GM_TITLE';
      case 'PENDING_SECURITY':
        return 'GET_PASS.DETAIL.NOTES_APPROVE_SECURITY_TITLE';
      default:
        return 'GET_PASS.DETAIL.NOTES_APPROVE_TITLE';
    }
  }

  approverDisplayName(ref: GetPassUserRef | null | undefined): string {
    if (!ref) return '';
    const name = `${ref.firstName ?? ''} ${ref.lastName ?? ''}`.trim();
    return name || '';
  }

  /** Audit cell: nested approver name, else `*ApprovedBy` id from API. */
  auditApproverCell(
    ref: GetPassUserRef | null | undefined,
    approvedById: string | null | undefined,
  ): string {
    const name = this.approverDisplayName(ref);
    if (name) return name;
    const id = approvedById?.trim();
    return id ?? '';
  }

  /** Security row: "pending" only until cleared or pass is terminal without stamp (legacy pre–security gate). */
  securityAuditShowPending(d: GetPassDetail): boolean {
    if (d.securityApprovedAt) return false;
    const legacyTerminal =
      ['APPROVED', 'OUT', 'RECEIVED_AT_DESTINATION', 'PARTIALLY_RETURNED', 'RETURNED', 'CLOSED'].includes(
        d.status,
      );
    if (legacyTerminal) return false;
    return true;
  }

  /**
   * Source property: checkout after approval. Hidden for internal-transfer viewers at the receiving hotel.
   */
  showCheckoutButton(): boolean {
    const d = this.data();
    if (!d || d.status !== 'APPROVED') return false;
    if (this.isViewerTargetTenant()) return false;
    return this.auth.hasPermission('GET_PASS_APPROVE_EXIT');
  }

  canReturn(): boolean {
    const d = this.data();
    if (!d) return false;
    if (!this.isViewerIssuerTenant()) return false;
    if (d.transferType === 'PERMANENT') return false;
    if (!['OUT', 'PARTIALLY_RETURNED'].includes(d.status)) return false;
    return this.auth.hasPermission('GET_PASS_APPROVE_RETURN');
  }

  canForceClose(): boolean {
    const d = this.data();
    if (!d || d.transferType === 'PERMANENT') return false;
    if (!this.isViewerIssuerTenant()) return false;
    return d.status === 'OUT' || d.status === 'PARTIALLY_RETURNED';
  }

  /** Current session tenant is the receiving hotel for this internal transfer. */
  isViewerTargetTenant(): boolean {
    const tid = this.auth.currentTenantId();
    const target = this.data()?.targetTenantId ?? null;
    return !!tid && !!target && tid === target;
  }

  /**
   * Destination staff confirm physical receipt (internal transfer, checked out from source).
   * Visible only when the pass is OUT, internal transfer, viewer is the receiving tenant, and JWT includes GET_PASS_CONFIRM_DESTINATION.
   */
  showConfirmReceiptButton(): boolean {
    const d = this.data();
    if (!d || d.status !== 'OUT' || d.isInternalTransfer !== true) return false;
    if (d.destinationDeptAcceptedAt) return false;
    if (!this.isViewerTargetTenant()) return false;
    return this.auth.hasPermission('GET_PASS_CONFIRM_DESTINATION');
  }

  /** After gate receipt: department manager (same dept name) or org manager at destination. */
  showAcceptIntoDeptButton(): boolean {
    const d = this.data();
    if (!d || !d.isInternalTransfer || !this.isViewerTargetTenant()) return false;
    if (d.destinationDeptAcceptedAt) return false;
    if (d.status !== 'RECEIVED_AT_DESTINATION') return false;
    if (this.auth.hasRole('ORG_MANAGER')) return true;
    if (!this.auth.hasRole('DEPT_MANAGER')) return false;
    const passDept = d.department?.name?.trim().toLowerCase() ?? '';
    const uDept = (this.auth.currentUser()?.department ?? '').trim().toLowerCase();
    return !!passDept && passDept === uDept;
  }

  /** Internal transfer @ destination: simplified 3-step progress instead of issuing-hotel approval chain. */
  showInternalDestinationProgress(): boolean {
    const d = this.data();
    return !!d?.isInternalTransfer && this.isViewerTargetTenant();
  }

  /** Department acceptance recorded — incoming workflow finished at this property (no further destination actions). */
  internalDestinationDeptComplete(d: GetPassDetail): boolean {
    return !!d.destinationDeptAcceptedAt;
  }

  /** Success banner after final department acceptance (internal transfer, receiving hotel). */
  showDestinationDeptCompleteBanner(): boolean {
    const d = this.data();
    return !!d?.isInternalTransfer && this.isViewerTargetTenant() && this.internalDestinationDeptComplete(d);
  }

  /** Gate receipt banner: only for the receiving property (copy refers to “your property”). */
  showDestinationReceiptBanner(): boolean {
    const d = this.data();
    return !!d?.isInternalTransfer && !!d.receivedAt && this.isViewerTargetTenant();
  }

  internalDestinationStepStatus(
    d: GetPassDetail,
    index: number,
  ): 'wait' | 'process' | 'finish' | 'error' {
    if (d.status === 'REJECTED') {
      return index === 0 ? 'error' : 'wait';
    }
    const s = d.status;
    /** Destination list/detail only shows OUT+ from API; progress should not advance until dispatch (OUT). */
    const afterCheckout = ['OUT', 'RECEIVED_AT_DESTINATION', 'PARTIALLY_RETURNED', 'RETURNED', 'CLOSED'].includes(
      s,
    );
    const afterGate = ['RECEIVED_AT_DESTINATION', 'PARTIALLY_RETURNED', 'RETURNED', 'CLOSED'].includes(s);

    if (index === 0) {
      if (afterCheckout) return 'finish';
      return 'wait';
    }
    if (index === 1) {
      if (afterGate) return 'finish';
      if (s === 'OUT') return 'process';
      return 'wait';
    }
    if (d.destinationDeptAcceptedAt) return 'finish';
    if (afterGate) return 'process';
    return 'wait';
  }

  internalDestinationNzCurrent(d: GetPassDetail): number {
    const st = [
      this.internalDestinationStepStatus(d, 0),
      this.internalDestinationStepStatus(d, 1),
      this.internalDestinationStepStatus(d, 2),
    ];
    if (st.every((x) => x === 'finish')) {
      return 2;
    }
    const proc = st.indexOf('process');
    if (proc >= 0) return proc;
    const err = st.indexOf('error');
    return err >= 0 ? err : 2;
  }

  /** Gate receipt: simple confirm (default condition Good) — no extra form. */
  confirmReceipt(): void {
    const id = this.data()?.id;
    if (!id || this.actionBusy()) return;
    this.modal.confirm({
      nzTitle: this.translate.instant('GET_PASS.DETAIL.CONFIRM_ENTRY_TITLE'),
      nzContent: this.translate.instant('GET_PASS.DETAIL.CONFIRM_ENTRY_MSG'),
      nzOkText: this.translate.instant('COMMON.CONFIRM'),
      nzCancelText: this.translate.instant('COMMON.CANCEL'),
      nzOnOk: () =>
        new Promise<void>((resolve, reject) => {
          this.actionBusy.set(true);
          this.api
            .confirmReceipt(id, { receivedCondition: 'Good', notes: '' })
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
              next: (detail) => {
                const normalized = this.normalizeDetail(detail);
                this.data.set(normalized);
                this.initReturnDrafts(normalized);
                this.actionBusy.set(false);
                this.message.success(this.translate.instant('GET_PASS.DETAIL.MSG_CONFIRM_RECEIPT'));
                resolve();
              },
              error: (e: Error) => {
                this.actionBusy.set(false);
                this.message.error(e.message || this.translate.instant('GET_PASS.DETAIL.ACTION_FAIL'));
                reject(e);
              },
            });
        }),
    });
  }

  acceptIntoDept(): void {
    const id = this.data()?.id;
    if (!id) return;
    this.confirmation
      .confirm({
        title: this.translate.instant('GET_PASS.DETAIL.CONFIRM_ACCEPT_DEPT_TITLE'),
        message: this.translate.instant('GET_PASS.DETAIL.CONFIRM_ACCEPT_DEPT_MSG'),
        confirmText: this.translate.instant('COMMON.CONFIRM'),
        cancelText: this.translate.instant('COMMON.CANCEL'),
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((ok) => {
        if (!ok) return;
        this.actionBusy.set(true);
        this.api
          .acceptIntoDepartment(id)
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe({
            next: (detail) => {
              const normalized = this.normalizeDetail(detail);
              this.data.set(normalized);
              this.initReturnDrafts(normalized);
              this.actionBusy.set(false);
              this.message.success(this.translate.instant('GET_PASS.DETAIL.MSG_ACCEPT_INTO_DEPT'));
            },
            error: (e: Error) => {
              this.actionBusy.set(false);
              this.message.error(e.message || this.translate.instant('GET_PASS.DETAIL.ACTION_FAIL'));
            },
          });
      });
  }

  /** Summary line for the “department acceptance complete” banner (internal transfer, destination). */
  destinationDeptCompleteDescription(d: GetPassDetail): string {
    const parts: string[] = [];
    if (d.destinationDeptAcceptedAt) {
      parts.push(
        this.translate.instant('GET_PASS.DETAIL.DESTINATION_DEPT_COMPLETE_AT', {
          date: this.datePipe.transform(d.destinationDeptAcceptedAt, 'medium') ?? d.destinationDeptAcceptedAt,
        }),
      );
    }
    const accepter = d.destinationDeptAccepter
      ? `${d.destinationDeptAccepter.firstName ?? ''} ${d.destinationDeptAccepter.lastName ?? ''}`.trim()
      : '';
    if (accepter) {
      parts.push(this.translate.instant('GET_PASS.DETAIL.DESTINATION_DEPT_COMPLETE_BY', { name: accepter }));
    }
    return parts.filter(Boolean).join(' · ');
  }

  destinationReceiptDescription(d: GetPassDetail): string {
    const parts: string[] = [];
    if (d.receivedAt) {
      parts.push(
        this.translate.instant('GET_PASS.DETAIL.DESTINATION_RECEIPT_AT', {
          date: this.datePipe.transform(d.receivedAt, 'medium') ?? d.receivedAt,
        }),
      );
    }
    if (d.receivedCondition?.trim()) {
      const c = d.receivedCondition.trim();
      const label = this.formatStoredReceivedCondition(c);
      parts.push(this.translate.instant('GET_PASS.DETAIL.DESTINATION_RECEIPT_CONDITION', { condition: label }));
    }
    if (d.receivedNotes?.trim()) {
      parts.push(
        this.translate.instant('GET_PASS.DETAIL.DESTINATION_RECEIPT_NOTES_LINE', {
          notes: d.receivedNotes.trim(),
        }),
      );
    }
    const receiver = d.receivedBy
      ? `${d.receivedBy.firstName ?? ''} ${d.receivedBy.lastName ?? ''}`.trim()
      : '';
    if (receiver) {
      parts.push(this.translate.instant('GET_PASS.DETAIL.DESTINATION_RECEIPT_BY', { name: receiver }));
    }
    return parts.filter(Boolean).join(' · ');
  }

  private formatStoredReceivedCondition(cond: string): string {
    const keys: Record<string, string> = {
      Excellent: 'GET_PASS.DETAIL.RECEIVED_COND_EXCELLENT',
      Good: 'GET_PASS.DETAIL.RECEIVED_COND_GOOD',
      Damaged: 'GET_PASS.DETAIL.RECEIVED_COND_DAMAGED',
      Missing: 'GET_PASS.DETAIL.RECEIVED_COND_MISSING',
    };
    const key = keys[cond];
    return key ? this.translate.instant(key) : cond;
  }

  submit(): void {
    const id = this.data()?.id;
    if (!id) return;
    this.actionBusy.set(true);
    this.api
      .submit(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (d) => {
          const normalized = this.normalizeDetail(d);
          this.data.set(normalized);
          this.initReturnDrafts(normalized);
          this.actionBusy.set(false);
          const msgKey =
            normalized.status === 'APPROVED'
              ? 'GET_PASS.DETAIL.MSG_SUBMIT_FULLY_APPROVED'
              : 'GET_PASS.DETAIL.MSG_SUBMIT';
          this.message.success(this.translate.instant(msgKey));
        },
        error: (e: Error) => {
          this.actionBusy.set(false);
          this.message.error(e.message || this.translate.instant('GET_PASS.DETAIL.ACTION_FAIL'));
        },
      });
  }

  openNotes(action: 'APPROVE' | 'REJECT'): void {
    this.notesAction.set(action);
    this.actionNotes.set('');
    this.notesOpen.set(true);
  }

  confirmNotes(): void {
    const id = this.data()?.id;
    const action = this.notesAction();
    const notes = this.actionNotes().trim();
    if (!id || !action) return;
    if (action === 'REJECT' && !notes) {
      this.message.warning(this.translate.instant('GET_PASS.DETAIL.REJECT_REASON_REQUIRED'));
      return;
    }
    this.actionBusy.set(true);
    const done = (msgKey: string) => {
      this.actionBusy.set(false);
      this.notesOpen.set(false);
      this.message.success(this.translate.instant(msgKey));
      this.load(id);
    };
    const fail = (e: Error) => {
      this.actionBusy.set(false);
      this.message.error(e.message || this.translate.instant('GET_PASS.DETAIL.ACTION_FAIL'));
    };
    if (action === 'APPROVE') {
      this.api
        .approve(id)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: () => done('GET_PASS.DETAIL.MSG_APPROVE'),
          error: fail,
        });
    } else {
      this.api
        .reject(id, notes)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: () => done('GET_PASS.DETAIL.MSG_REJECT'),
          error: fail,
        });
    }
  }

  checkout(): void {
    const id = this.data()?.id;
    if (!id) return;
    this.confirmation
      .confirm({
        title: this.translate.instant('GET_PASS.DETAIL.CONFIRM_CHECKOUT_TITLE'),
        message: this.translate.instant('GET_PASS.DETAIL.CONFIRM_CHECKOUT_MSG'),
        confirmText: this.translate.instant('COMMON.CONFIRM'),
        cancelText: this.translate.instant('COMMON.CANCEL'),
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((ok) => {
        if (ok) this.run(() => this.api.checkout(id, []), 'GET_PASS.DETAIL.MSG_CHECKOUT');
      });
  }

  closePass(): void {
    const id = this.data()?.id;
    if (!id) return;
    this.confirmation
      .confirm({
        title: this.translate.instant('GET_PASS.DETAIL.CONFIRM_CLOSE_TITLE'),
        message: this.translate.instant('GET_PASS.DETAIL.CONFIRM_CLOSE_MSG'),
        confirmText: this.translate.instant('COMMON.CONFIRM'),
        cancelText: this.translate.instant('COMMON.CANCEL'),
        confirmDanger: true,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((ok) => {
        if (ok) this.run(() => this.api.close(id), 'GET_PASS.DETAIL.MSG_CLOSE');
      });
  }

  deletePass(): void {
    const id = this.data()?.id;
    if (!id) return;
    this.confirmation
      .confirm({
        title: this.translate.instant('GET_PASS.DETAIL.CONFIRM_DELETE_TITLE'),
        message: this.translate.instant('GET_PASS.DETAIL.CONFIRM_DELETE_MSG'),
        confirmText: this.translate.instant('COMMON.DELETE'),
        cancelText: this.translate.instant('COMMON.CANCEL'),
        confirmDanger: true,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((ok) => {
        if (!ok) return;
        this.actionBusy.set(true);
        this.api
          .delete(id)
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe({
            next: () => {
              this.actionBusy.set(false);
              this.message.success(this.translate.instant('GET_PASS.DETAIL.MSG_DELETED'));
              this.router.navigate(['/get-passes']);
            },
            error: (e: Error) => {
              this.actionBusy.set(false);
              this.message.error(e.message || this.translate.instant('GET_PASS.DETAIL.ACTION_FAIL'));
            },
          });
      });
  }

  printPdf(): void {
    const id = this.data()?.id;
    const no = this.data()?.passNo ?? 'pass';
    if (!id) return;
    this.api
      .exportPdf(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (blob) => {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `GatePass_${no}.pdf`;
          a.click();
          URL.revokeObjectURL(url);
        },
        error: () => this.message.error(this.translate.instant('GET_PASS.DETAIL.PDF_FAIL')),
      });
  }

  openReturn(): void {
    const d = this.data();
    if (d) this.initReturnDrafts(d);
    this.returnGlobalNotes.set('');
    this.returnOpen.set(true);
  }

  updateReturnDraft(index: number, patch: Partial<ReturnDraft>): void {
    this.returnLines.update((rows) => {
      const next = [...rows];
      if (next[index]) next[index] = { ...next[index], ...patch };
      return next;
    });
  }

  /** Max good qty given current lost/damaged qty and flag. */
  maxGoodForReturnRow(row: ReturnDraft): number {
    const affected = row.returnFlag === 'NONE' ? 0 : this.num(row.qtyAffected);
    return Math.max(0, row.maxReturn - affected);
  }

  /** Max lost/damaged qty given current good qty. */
  maxAffectedForReturnRow(row: ReturnDraft): number {
    return Math.max(0, row.maxReturn - this.num(row.qtyGood));
  }

  onReturnGoodChange(index: number, raw: number | null | undefined): void {
    this.returnLines.update((rows) => {
      const next = [...rows];
      const cur = next[index];
      if (!cur) return next;
      const affectedBefore = cur.returnFlag === 'NONE' ? 0 : this.num(cur.qtyAffected);
      const maxG = Math.max(0, cur.maxReturn - affectedBefore);
      let qtyGood = Math.min(Math.max(0, Number(raw ?? 0)), maxG);
      let qtyAffected = cur.qtyAffected;
      if (cur.returnFlag !== 'NONE') {
        const maxA = Math.max(0, cur.maxReturn - qtyGood);
        qtyAffected = Math.min(this.num(qtyAffected), maxA);
      }
      next[index] = { ...cur, qtyGood, qtyAffected };
      return next;
    });
  }

  onReturnAffectedChange(index: number, raw: number | null | undefined): void {
    this.returnLines.update((rows) => {
      const next = [...rows];
      const cur = next[index];
      if (!cur || cur.returnFlag === 'NONE') return next;
      const maxA = Math.max(0, cur.maxReturn - this.num(cur.qtyGood));
      let qtyAffected = Math.min(Math.max(0, Number(raw ?? 0)), maxA);
      const maxG = Math.max(0, cur.maxReturn - qtyAffected);
      const qtyGood = Math.min(this.num(cur.qtyGood), maxG);
      next[index] = { ...cur, qtyAffected, qtyGood };
      return next;
    });
  }

  patchReturnFlag(index: number, flag: ReturnConditionFlag): void {
    this.returnLines.update((rows) => {
      const next = [...rows];
      const cur = next[index];
      if (!cur) return next;
      if (flag === 'NONE') {
        next[index] = { ...cur, returnFlag: flag, qtyAffected: 0 };
        return next;
      }
      const maxA = Math.max(0, cur.maxReturn - this.num(cur.qtyGood));
      const qtyAffected = Math.min(this.num(cur.qtyAffected), maxA);
      next[index] = { ...cur, returnFlag: flag, qtyAffected };
      return next;
    });
  }

  submitReturn(): void {
    const id = this.data()?.id;
    if (!id) return;
    const lines: GetPassReturnLinePayload[] = [];
    for (const row of this.returnLines()) {
      const affected =
        row.returnFlag === 'LOST' || row.returnFlag === 'DAMAGED' ? this.num(row.qtyAffected) : 0;
      const good = this.num(row.qtyGood);
      const sum = good + affected;
      if (sum <= 0) continue;
      if (sum > row.maxReturn) {
        this.message.error(this.translate.instant('GET_PASS.DETAIL.RETURN_SUM_INVALID'));
        return;
      }
      if (row.returnFlag !== 'NONE' && affected <= 0) {
        this.message.error(this.translate.instant('GET_PASS.DETAIL.RETURN_AFFECTED_REQUIRED'));
        return;
      }
      lines.push({
        lineId: row.lineId,
        qtyGood: good,
        lostQty: row.returnFlag === 'LOST' ? affected : 0,
        damagedQty: row.returnFlag === 'DAMAGED' ? affected : 0,
        conditionIn: row.conditionIn.trim() || undefined,
      });
    }
    if (lines.length === 0) {
      this.message.warning(this.translate.instant('GET_PASS.DETAIL.RETURN_EMPTY'));
      return;
    }
    this.actionBusy.set(true);
    this.api
      .returnItems(id, lines, this.returnGlobalNotes().trim() || null)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (d) => {
          const normalized = this.normalizeDetail(d);
          this.data.set(normalized);
          this.initReturnDrafts(normalized);
          this.actionBusy.set(false);
          this.returnOpen.set(false);
          this.message.success(this.translate.instant('GET_PASS.DETAIL.MSG_RETURN'));
        },
        error: (e: Error) => {
          this.actionBusy.set(false);
          this.message.error(e.message || this.translate.instant('GET_PASS.DETAIL.ACTION_FAIL'));
        },
      });
  }

  private run(factory: () => Observable<GetPassDetail>, okKey: string): void {
    if (!this.data()?.id) return;
    this.actionBusy.set(true);
    factory()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (d) => {
          const normalized = this.normalizeDetail(d);
          this.data.set(normalized);
          this.initReturnDrafts(normalized);
          this.actionBusy.set(false);
          this.message.success(this.translate.instant(okKey));
        },
        error: (e: Error) => {
          this.actionBusy.set(false);
          this.message.error(e.message || this.translate.instant('GET_PASS.DETAIL.ACTION_FAIL'));
        },
      });
  }

  returnHistoryRows(): Array<{
    id: string;
    itemName: string;
    qty: number;
    returnDate: string;
    conditionIn?: string | null;
    notes?: string | null;
    receiver?: string;
    flags?: string;
  }> {
    const d = this.data();
    if (!d) return [];
    const out: Array<{
      id: string;
      itemName: string;
      qty: number;
      returnDate: string;
      conditionIn?: string | null;
      notes?: string | null;
      receiver?: string;
      flags?: string;
    }> = [];
    for (const line of d.lines ?? []) {
      const name = line.item?.name ?? '';
      for (const r of line.returns ?? []) {
        const g = this.num(r.qtyGood ?? 0);
        const l = this.num(r.qtyLost ?? 0);
        const qtyDamaged = this.num(r.qtyDamaged ?? 0);
        const parts: string[] = [];
        if (g > 0) {
          parts.push(this.translate.instant('GET_PASS.DETAIL.RETURN_HIST_GOOD', { qty: g }));
        }
        if (l > 0) {
          parts.push(this.translate.instant('GET_PASS.DETAIL.RETURN_HIST_LOST', { qty: l }));
        }
        if (qtyDamaged > 0) {
          parts.push(this.translate.instant('GET_PASS.DETAIL.RETURN_HIST_DAMAGED', { qty: qtyDamaged }));
        }
        if (!parts.length && r.isLost) {
          parts.push(this.translate.instant('GET_PASS.DETAIL.LOST'));
        }
        if (!parts.length && r.isDamaged) {
          parts.push(this.translate.instant('GET_PASS.DETAIL.DAMAGED'));
        }
        out.push({
          id: r.id,
          itemName: name,
          qty: this.num(r.qtyReturned),
          returnDate: r.returnDate,
          conditionIn: r.conditionIn,
          notes: r.notes,
          receiver: r.registeredByUser
            ? `${r.registeredByUser.firstName ?? ''} ${r.registeredByUser.lastName ?? ''}`.trim()
            : undefined,
          flags: parts.length ? parts.join(', ') : undefined,
        });
      }
    }
    return out;
  }
}
