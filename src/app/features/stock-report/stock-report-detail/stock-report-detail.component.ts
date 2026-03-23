import { DatePipe } from '@angular/common';
import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { LucideAngularModule } from 'lucide-angular';
import { ArrowLeft, Check, ClipboardList, Download, Send, X } from 'lucide-angular';
import { AuthService } from '../../../core/services/auth.service';
import { ConfirmationService } from '../../../core/services/confirmation.service';
import type { SavedStockReportDetail, StockReportLine } from '../models/stock-report.model';
import { canApproveStockReport, canSubmitStockReport } from '../models/stock-report.model';
import { StockReportService } from '../services/stock-report.service';

@Component({
  selector: 'app-stock-report-detail',
  standalone: true,
  imports: [
    DatePipe,
    FormsModule,
    RouterLink,
    NzButtonModule,
    NzInputModule,
    TranslatePipe,
    LucideAngularModule,
  ],
  providers: [ConfirmationService],
  templateUrl: './stock-report-detail.component.html',
  styleUrl: './stock-report-detail.component.scss',
})
export class StockReportDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly stockApi = inject(StockReportService);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);
  private readonly auth = inject(AuthService);
  private readonly confirmation = inject(ConfirmationService);
  private readonly destroyRef = inject(DestroyRef);

  readonly lucideBack = ArrowLeft;
  readonly lucideClip = ClipboardList;
  readonly lucideDownload = Download;
  readonly lucideSend = Send;
  readonly lucideCheck = Check;
  readonly lucideX = X;

  readonly loading = signal(true);
  readonly acting = signal(false);
  readonly report = signal<SavedStockReportDetail | null>(null);
  readonly error = signal<string | null>(null);
  showReject = false;
  rejectReason = '';

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.router.navigate(['/stock-report']);
      return;
    }
    this.load(id);
  }

  load(id: string): void {
    this.loading.set(true);
    this.stockApi
      .getSavedReportById(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (r) => {
          this.report.set(r);
          this.loading.set(false);
        },
        error: () => {
          this.error.set(this.translate.instant('STOCK_REPORT.ERRORS.NOT_FOUND'));
          this.loading.set(false);
        },
      });
  }

  fmt(n: unknown): string {
    return `SAR ${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  canSubmit(): boolean {
    const r = this.report();
    return !!r && r.status === 'DRAFT' && canSubmitStockReport(this.auth.currentUser()?.role);
  }

  canApprove(): boolean {
    const r = this.report();
    return !!r && r.status === 'PENDING_APPROVAL' && canApproveStockReport(this.auth.currentUser()?.role);
  }

  exportPdf(): void {
    const id = this.report()?.id;
    if (!id) return;
    this.stockApi.exportPdf(id).subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Stock_Variance_Report_${this.report()?.reportNo ?? id}.pdf`;
        a.click();
        window.URL.revokeObjectURL(url);
      },
      error: () => this.message.error(this.translate.instant('STOCK_REPORT.ERRORS.PDF')),
    });
  }

  submit(): void {
    const id = this.report()?.id;
    if (!id) return;
    this.confirmation
      .confirm({
        title: this.translate.instant('STOCK_REPORT.CONFIRM_SUBMIT_TITLE'),
        message: this.translate.instant('STOCK_REPORT.CONFIRM_SUBMIT_MSG'),
        confirmText: this.translate.instant('COMMON.CONFIRM'),
        cancelText: this.translate.instant('COMMON.CANCEL'),
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((ok) => {
        if (!ok) return;
        this.acting.set(true);
        this.stockApi
          .submitReport(id)
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe({
            next: () => {
              this.message.success(this.translate.instant('STOCK_REPORT.MSG.SUBMITTED'));
              this.load(id);
              this.acting.set(false);
            },
            error: (e: { error?: { error?: string } }) => {
              this.message.error(e?.error?.error ?? '—');
              this.acting.set(false);
            },
          });
      });
  }

  approve(): void {
    const id = this.report()?.id;
    if (!id) return;
    this.acting.set(true);
    this.stockApi
      .approveReport(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.message.success(this.translate.instant('STOCK_REPORT.MSG.APPROVED'));
          this.load(id);
          this.acting.set(false);
        },
        error: (e: { error?: { error?: string } }) => {
          this.message.error(e?.error?.error ?? '—');
          this.acting.set(false);
        },
      });
  }

  confirmReject(): void {
    const id = this.report()?.id;
    if (!id || !this.rejectReason.trim()) return;
    this.acting.set(true);
    this.stockApi
      .rejectReport(id, this.rejectReason.trim())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.message.success(this.translate.instant('STOCK_REPORT.MSG.REJECTED'));
          this.showReject = false;
          this.rejectReason = '';
          this.load(id);
          this.acting.set(false);
        },
        error: (e: { error?: { error?: string } }) => {
          this.message.error(e?.error?.error ?? '—');
          this.acting.set(false);
        },
      });
  }

  lineVarQty(l: StockReportLine): number {
    const countQty = Number(l.inwardQty ?? 0);
    const bookQty = Number(l.closingQty ?? 0);
    return Number(l.outwardQty ?? countQty - bookQty);
  }

  lineVarVal(l: StockReportLine): number {
    return Number(l.outwardValue ?? 0);
  }
}
