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
import { NzTableModule } from 'ng-zorro-antd/table';
import { Observable } from 'rxjs';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { LucideAngularModule } from 'lucide-angular';
import { ArrowLeft, CheckCircle2, Package, Printer, XCircle } from 'lucide-angular';
import type { GetPassStatus, GetPassType } from '../../../core/models/enums';
import { AuthService } from '../../../core/services/auth.service';
import { ConfirmationService } from '../../../core/services/confirmation.service';
import type { GetPassDetail, GetPassReturnLinePayload } from '../models/get-pass.model';
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
    NzTableModule,
    TranslatePipe,
    LucideAngularModule,
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
      case 'PENDING_FINANCE':
      case 'PENDING_SECURITY':
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

  isAdmin(): boolean {
    const r = this.auth.currentUser()?.role;
    return r === 'ADMIN' || r === 'SUPER_ADMIN';
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

  canApprove(): boolean {
    const d = this.data();
    const u = this.auth.currentUser();
    if (!d || !u) return false;
    const admin = this.isAdmin();
    if (d.status === 'PENDING_DEPT') return admin || u.role === 'DEPT_MANAGER';
    if (d.status === 'PENDING_FINANCE') return admin || u.role === 'FINANCE_MANAGER';
    if (d.status === 'PENDING_SECURITY') return admin || u.role === 'SECURITY';
    return false;
  }

  canCheckout(): boolean {
    const d = this.data();
    const u = this.auth.currentUser();
    if (!d || !u) return false;
    return d.status === 'APPROVED' && (this.isAdmin() || u.role === 'SECURITY');
  }

  canReturn(): boolean {
    const d = this.data();
    const u = this.auth.currentUser();
    if (!d || !u) return false;
    if (d.transferType === 'PERMANENT') return false;
    if (!['OUT', 'PARTIALLY_RETURNED'].includes(d.status)) return false;
    return this.isAdmin() || u.role === 'SECURITY';
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
      this.message.warning(this.translate.instant('GET_PASS.DETAIL.REJECT_NOTES_REQUIRED'));
      return;
    }
    this.actionBusy.set(true);
    this.api
      .approve(id, action, notes || null)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (d) => {
          this.data.set(d);
          this.initReturnDrafts(d);
          this.actionBusy.set(false);
          this.notesOpen.set(false);
          this.message.success(this.translate.instant('GET_PASS.DETAIL.MSG_APPROVE'));
        },
        error: (e: Error) => {
          this.actionBusy.set(false);
          this.message.error(e.message || this.translate.instant('GET_PASS.DETAIL.ACTION_FAIL'));
        },
      });
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
