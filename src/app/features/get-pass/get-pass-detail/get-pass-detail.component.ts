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
import { NzModalModule } from 'ng-zorro-antd/modal';
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

interface ReturnDraft {
  lineId: string;
  itemName: string;
  maxReturn: number;
  qtyReturned: number;
  conditionIn: string;
  isDamaged: boolean;
  isLost: boolean;
}

@Component({
  selector: 'app-get-pass-detail',
  standalone: true,
  providers: [ConfirmationService],
  imports: [
    DatePipe,
    NgClass,
    FormsModule,
    NzAlertModule,
    NzButtonModule,
    NzInputModule,
    NzInputNumberModule,
    NzModalModule,
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
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);

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

  load(id: string): void {
    this.loading.set(true);
    this.error.set('');
    this.api
      .getById(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (d) => {
          this.data.set(d);
          this.initReturnDrafts(d);
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
    for (const line of d.lines) {
      const max = this.num(line.qty) - this.num(line.qtyReturned);
      if (max <= 0) continue;
      rows.push({
        lineId: line.id,
        itemName: line.item?.name ?? line.itemId,
        maxReturn: max,
        qtyReturned: 0,
        conditionIn: '',
        isDamaged: false,
        isLost: false,
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
        return 'pending';
      case 'APPROVED':
      case 'OUT':
        return 'processing';
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

  canSubmit(): boolean {
    const d = this.data();
    return !!d && d.status === 'DRAFT';
  }

  canEdit(): boolean {
    return this.canSubmit();
  }

  canDelete(): boolean {
    const d = this.data();
    if (!d) return false;
    return d.status === 'DRAFT' || d.status === 'REJECTED';
  }

  /** ADMIN / SUPER_ADMIN may act at any workflow step (backend still enforces). */
  isAdminBypass(): boolean {
    return this.auth.hasRole('ADMIN', 'SUPER_ADMIN');
  }

  showPendingDeptActions(): boolean {
    const d = this.data();
    if (!d || d.status !== 'PENDING_DEPT') return false;
    return (
      this.isAdminBypass() ||
      this.auth.hasRole('DEPT_MANAGER') ||
      this.auth.hasPermission('GET_PASS_APPROVE')
    );
  }

  showCostControlVerifyActions(): boolean {
    const d = this.data();
    if (!d || d.status !== 'PENDING_COST_CONTROL') return false;
    return this.isAdminBypass() || this.auth.hasRole('COST_CONTROL');
  }

  showFinanceSignActions(): boolean {
    const d = this.data();
    if (!d || d.status !== 'PENDING_FINANCE') return false;
    return this.isAdminBypass() || this.auth.hasRole('FINANCE_MANAGER');
  }

  showGmAuthorizeActions(): boolean {
    const d = this.data();
    if (!d || d.status !== 'PENDING_GM') return false;
    return this.isAdminBypass() || this.auth.hasRole('GENERAL_MANAGER');
  }

  /** True when any workflow approve/reject pair is shown and the user is acting via admin role. */
  showAdminActionLabel(): boolean {
    if (!this.isAdminBypass()) return false;
    return (
      this.showPendingDeptActions() ||
      this.showCostControlVerifyActions() ||
      this.showFinanceSignActions() ||
      this.showGmAuthorizeActions()
    );
  }

  /** Pass is waiting on one of the four approval roles (admin sees every approve action, one enabled). */
  isWorkflowApprovalPending(): boolean {
    const d = this.data();
    if (!d) return false;
    return (
      d.status === 'PENDING_DEPT' ||
      d.status === 'PENDING_COST_CONTROL' ||
      d.status === 'PENDING_FINANCE' ||
      d.status === 'PENDING_GM'
    );
  }

  canRejectWorkflow(): boolean {
    return (
      this.showPendingDeptActions() ||
      this.showCostControlVerifyActions() ||
      this.showFinanceSignActions() ||
      this.showGmAuthorizeActions()
    );
  }

  /**
   * Workflow steps: 0 Draft → 1 Dept → 2 Cost control → 3 Finance → 4 GM → 5 Approved.
   * Matches statuses (e.g. PENDING_COST_CONTROL → active step index 2).
   */
  workflowActiveIndex(status: GetPassStatus): number {
    switch (status) {
      case 'DRAFT':
        return 0;
      case 'PENDING_DEPT':
        return 1;
      case 'PENDING_COST_CONTROL':
        return 2;
      case 'PENDING_FINANCE':
        return 3;
      case 'PENDING_GM':
        return 4;
      case 'APPROVED':
      case 'OUT':
      case 'PARTIALLY_RETURNED':
      case 'RETURNED':
      case 'CLOSED':
        return 5;
      default:
        return 0;
    }
  }

  private rejectionErrorStepIndex(d: GetPassDetail): number {
    if (!d.deptApprovedAt) return 1;
    if (!d.costControlApprovedAt) return 2;
    if (!d.financeApprovedAt) return 3;
    if (!d.gmApprovedAt) return 4;
    return 5;
  }

  workflowStepStatuses(d: GetPassDetail): Array<'wait' | 'process' | 'finish' | 'error'> {
    const terminal: GetPassStatus[] = [
      'APPROVED',
      'OUT',
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

  canCheckout(): boolean {
    const d = this.data();
    if (!d) return false;
    return d.status === 'APPROVED' && this.auth.hasPermission('GET_PASS_APPROVE_EXIT');
  }

  canReturn(): boolean {
    const d = this.data();
    if (!d) return false;
    if (d.transferType === 'PERMANENT') return false;
    if (!['OUT', 'PARTIALLY_RETURNED'].includes(d.status)) return false;
    return this.auth.hasPermission('GET_PASS_APPROVE_RETURN');
  }

  canForceClose(): boolean {
    const d = this.data();
    if (!d || d.transferType === 'PERMANENT') return false;
    return d.status === 'OUT' || d.status === 'PARTIALLY_RETURNED';
  }

  submit(): void {
    const id = this.data()?.id;
    if (!id) return;
    this.run(() => this.api.submit(id), 'GET_PASS.DETAIL.MSG_SUBMIT');
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

  submitReturn(): void {
    const id = this.data()?.id;
    if (!id) return;
    const lines: GetPassReturnLinePayload[] = [];
    for (const row of this.returnLines()) {
      if (row.qtyReturned <= 0) continue;
      if (row.qtyReturned > row.maxReturn) {
        this.message.error(this.translate.instant('GET_PASS.DETAIL.RETURN_QTY_INVALID'));
        return;
      }
      lines.push({
        lineId: row.lineId,
        qtyReturned: row.qtyReturned,
        conditionIn: row.conditionIn.trim() || undefined,
        isDamaged: row.isDamaged,
        isLost: row.isLost,
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
          this.data.set(d);
          this.initReturnDrafts(d);
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
          this.data.set(d);
          this.initReturnDrafts(d);
          this.actionBusy.set(false);
          this.message.success(this.translate.instant(okKey));
        },
        error: (e: Error) => {
          this.actionBusy.set(false);
          this.message.error(e.message || this.translate.instant('GET_PASS.DETAIL.ACTION_FAIL'));
        },
      });
  }

  returnHistoryRows(): Array<{ id: string; itemName: string; qty: number; returnDate: string; conditionIn?: string | null; notes?: string | null; receiver?: string }> {
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
    }> = [];
    for (const line of d.lines) {
      const name = line.item?.name ?? '';
      for (const r of line.returns ?? []) {
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
        });
      }
    }
    return out;
  }
}
