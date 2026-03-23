import { DatePipe } from '@angular/common';
import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTableModule } from 'ng-zorro-antd/table';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { LucideAngularModule } from 'lucide-angular';
import { AlertCircle, Calendar, Check, Lock, RefreshCw, Unlock } from 'lucide-angular';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { ConfirmationService } from '../../../core/services/confirmation.service';
import type { PeriodCloseRow } from '../models/period-close.model';
import { PeriodCloseService } from '../services/period-close.service';

@Component({
  selector: 'app-period-close-page',
  standalone: true,
  imports: [
    DatePipe,
    FormsModule,
    NzButtonModule,
    NzInputModule,
    NzModalModule,
    NzSelectModule,
    NzSpinModule,
    NzTableModule,
    TranslatePipe,
    LucideAngularModule,
    EmptyStateComponent,
  ],
  providers: [ConfirmationService],
  templateUrl: './period-close-page.component.html',
  styles: [`:host { display: block; }`],
})
export class PeriodClosePageComponent implements OnInit {
  private readonly api = inject(PeriodCloseService);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);
  private readonly confirmation = inject(ConfirmationService);
  private readonly destroyRef = inject(DestroyRef);

  readonly lucideCalendar = Calendar;
  readonly lucideLock = Lock;
  readonly lucideUnlock = Unlock;
  readonly lucideCheck = Check;
  readonly lucideAlert = AlertCircle;
  readonly lucideRefresh = RefreshCw;

  readonly loading = signal(true);
  readonly closing = signal(false);
  readonly periods = signal<PeriodCloseRow[]>([]);
  readonly showForm = signal(false);
  year = new Date().getFullYear();
  month: number | '' = '';
  notes = '';

  readonly years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);
  readonly monthNums = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

  ngOnInit(): void {
    this.load();
  }

  monthLabel(m: number): string {
    return new Date(2000, m - 1, 1).toLocaleString(this.translate.currentLang === 'ar' ? 'ar' : 'en', {
      month: 'long',
    });
  }

  load(): void {
    this.loading.set(true);
    this.api
      .list()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (rows) => {
          this.periods.set(Array.isArray(rows) ? rows : []);
          this.loading.set(false);
        },
        error: () => {
          this.message.error(this.translate.instant('PERIOD_CLOSE.ERRORS.LOAD'));
          this.loading.set(false);
        },
      });
  }

  toggleForm(): void {
    this.showForm.update((v) => !v);
  }

  confirmClose(): void {
    const label = this.periodLabel(this.year, this.month);
    this.confirmation
      .confirm({
        title: this.translate.instant('PERIOD_CLOSE.CONFIRM_CLOSE_TITLE'),
        message: this.translate.instant('PERIOD_CLOSE.CONFIRM_CLOSE_MSG', { period: label }),
        confirmText: this.translate.instant('COMMON.CONFIRM'),
        cancelText: this.translate.instant('COMMON.CANCEL'),
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((ok) => {
        if (ok) this.doClose();
      });
  }

  private doClose(): void {
    this.closing.set(true);
    this.api
      .close({
        year: this.year,
        month: this.month === '' ? null : this.month,
        notes: this.notes || undefined,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.message.success(this.translate.instant('PERIOD_CLOSE.MSG.CLOSED'));
          this.showForm.set(false);
          this.notes = '';
          this.load();
          this.closing.set(false);
        },
        error: (e: { error?: { error?: string } }) => {
          this.message.error(e?.error?.error ?? this.translate.instant('PERIOD_CLOSE.ERRORS.CLOSE'));
          this.closing.set(false);
        },
      });
  }

  reopen(p: PeriodCloseRow): void {
    const label = this.periodLabel(p.year, p.month ?? '');
    this.confirmation
      .confirm({
        title: this.translate.instant('PERIOD_CLOSE.CONFIRM_REOPEN_TITLE'),
        message: this.translate.instant('PERIOD_CLOSE.CONFIRM_REOPEN_MSG', { period: label }),
        confirmText: this.translate.instant('COMMON.CONFIRM'),
        cancelText: this.translate.instant('COMMON.CANCEL'),
        confirmDanger: true,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((ok) => {
        if (!ok) return;
        this.api
          .reopen(p.id)
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe({
            next: () => {
              this.message.success(this.translate.instant('PERIOD_CLOSE.MSG.REOPENED'));
              this.load();
            },
            error: (e: { error?: { error?: string } }) => {
              this.message.error(e?.error?.error ?? this.translate.instant('PERIOD_CLOSE.ERRORS.REOPEN'));
            },
          });
      });
  }

  periodLabel(year: number, month: number | '' | null): string {
    if (month === '' || month == null) {
      return `${year} (${this.translate.instant('PERIOD_CLOSE.LABEL_ANNUAL')})`;
    }
    const d = new Date(2000, Number(month) - 1, 1);
    return `${d.toLocaleString(this.translate.currentLang === 'ar' ? 'ar' : 'en', { month: 'long' })} ${year}`;
  }

}
