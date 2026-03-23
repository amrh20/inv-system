import { DatePipe } from '@angular/common';
import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTableModule } from 'ng-zorro-antd/table';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { LucideAngularModule } from 'lucide-angular';
import { BarChart3, Download, RefreshCw, Save, Search, Upload } from 'lucide-angular';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import type { CategoryRow } from '../../master-data/models/category.model';
import type { DepartmentRow } from '../../master-data/models/department.model';
import type { SavedStockReportListRow, StockReportData, StockReportItem } from '../models/stock-report.model';
import { CategoriesService } from '../../master-data/services/categories.service';
import { DepartmentsService } from '../../master-data/services/departments.service';
import { StockReportService } from '../services/stock-report.service';

@Component({
  selector: 'app-stock-report-page',
  standalone: true,
  imports: [
    DatePipe,
    FormsModule,
    RouterLink,
    NzButtonModule,
    NzInputModule,
    NzSelectModule,
    NzSpinModule,
    NzTableModule,
    TranslatePipe,
    LucideAngularModule,
    EmptyStateComponent,
  ],
  templateUrl: './stock-report-page.component.html',
  styleUrl: './stock-report-page.component.scss',
})
export class StockReportPageComponent implements OnInit {
  private readonly stockApi = inject(StockReportService);
  private readonly departmentsApi = inject(DepartmentsService);
  private readonly categoriesApi = inject(CategoriesService);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly lucideChart = BarChart3;
  readonly lucideSearch = Search;
  readonly lucideSave = Save;
  readonly lucideDownload = Download;
  readonly lucideUpload = Upload;
  readonly lucideRefresh = RefreshCw;

  readonly departments = signal<DepartmentRow[]>([]);
  readonly categories = signal<CategoryRow[]>([]);
  departmentId = '';
  categoryId = '';
  year = new Date().getFullYear();
  readonly years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly uploading = signal(false);
  readonly report = signal<StockReportData | null>(null);
  readonly originalReport = signal<StockReportData | null>(null);
  readonly blindCount = signal(false);
  managementNotes = '';
  readonly activeTab = signal<'generate' | 'saved'>('generate');
  readonly savedLoading = signal(false);
  readonly savedRows = signal<SavedStockReportListRow[]>([]);

  /** localCounts[itemId][locId] = string for inputs */
  localCounts = signal<Record<string, Record<string, string>>>({});

  ngOnInit(): void {
    this.departmentsApi
      .list({ take: 200 })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((r) => this.departments.set(r.departments));
    this.categoriesApi
      .list({ take: 200 })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((r) => this.categories.set(r.categories));
  }

  filteredCategories(): CategoryRow[] {
    const d = this.departmentId;
    const cats = this.categories();
    if (!d) return cats;
    return cats.filter((c) => c.departmentId === d);
  }

  onDeptChange(): void {
    this.categoryId = '';
    this.report.set(null);
  }

  generate(): void {
    if (!this.departmentId) {
      this.message.warning(this.translate.instant('STOCK_REPORT.ERRORS.DEPT'));
      return;
    }
    this.loading.set(true);
    this.stockApi
      .getReport({
        departmentId: this.departmentId,
        categoryId: this.categoryId || undefined,
        year: this.year,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => {
          this.report.set(data);
          this.originalReport.set(JSON.parse(JSON.stringify(data)) as StockReportData);
          this.initLocalCounts(data);
          this.loading.set(false);
        },
        error: (e: { error?: { error?: string } }) => {
          this.message.error(e?.error?.error ?? this.translate.instant('STOCK_REPORT.ERRORS.LOAD'));
          this.loading.set(false);
        },
      });
  }

  private initLocalCounts(data: StockReportData): void {
    const next: Record<string, Record<string, string>> = {};
    for (const item of data.items) {
      next[item.itemId] = {};
      for (const loc of data.locations) {
        const v = item.locationQtys?.[loc.id];
        next[item.itemId][loc.id] = v != null ? String(v) : '';
      }
    }
    this.localCounts.set(next);
  }

  setCount(itemId: string, locId: string, val: string): void {
    this.localCounts.update((m) => ({
      ...m,
      [itemId]: { ...(m[itemId] ?? {}), [locId]: val },
    }));
  }

  getCount(itemId: string, locId: string): string {
    return this.localCounts()[itemId]?.[locId] ?? '';
  }

  bookQty(item: StockReportItem, locId: string): number {
    if (item.bookLocationQtys) {
      return Number(item.bookLocationQtys[locId] ?? 0);
    }
    return Number(item.locationQtys?.[locId] ?? 0);
  }

  varQty(itemId: string, locId: string, item: StockReportItem): number | null {
    const raw = this.getCount(itemId, locId);
    if (raw === '') return null;
    return Number(raw) - this.bookQty(item, locId);
  }

  buildMergedReport(): StockReportData | null {
    const base = this.report();
    if (!base) return null;
    const counts = this.localCounts();
    const items = base.items.map((item) => {
      const merged: Record<string, number> = { ...(item.locationQtys ?? {}) };
      const row = counts[item.itemId] ?? {};
      for (const [locId, val] of Object.entries(row)) {
        if (val !== '') merged[locId] = Number(val);
      }
      return { ...item, locationQtys: merged };
    });
    return { ...base, items };
  }

  saveDraft(): void {
    const merged = this.buildMergedReport();
    if (!merged || !this.departmentId) return;
    const locId = merged.locations[0]?.id;
    if (!locId) {
      this.message.error(this.translate.instant('STOCK_REPORT.ERRORS.NO_LOCATION'));
      return;
    }
    const orig = this.originalReport();
    const bookMap: Record<string, number> = {};
    const bookLocMap: Record<string, Record<string, number>> = {};
    if (orig) {
      for (const o of orig.items) {
        bookMap[o.itemId] = o.closeStock;
        bookLocMap[o.itemId] = { ...(o.locationQtys ?? {}) };
      }
    }
    const reportData = {
      ...merged,
      items: merged.items.map((item) => ({
        ...item,
        bookCloseQty: bookMap[item.itemId] ?? item.closeStock,
        bookLocationQtys: bookLocMap[item.itemId] ?? item.locationQtys,
      })),
    } as StockReportData;

    this.saving.set(true);
    this.stockApi
      .saveReport({
        departmentId: this.departmentId,
        locationId: locId,
        notes: this.managementNotes || this.translate.instant('STOCK_REPORT.DRAFT_AUTO_NOTE', { year: this.year }),
        reportData,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.message.success(this.translate.instant('STOCK_REPORT.MSG.SAVED'));
          this.saving.set(false);
          this.activeTab.set('saved');
          this.loadSaved();
        },
        error: (e: { error?: { error?: string } }) => {
          this.message.error(e?.error?.error ?? this.translate.instant('STOCK_REPORT.ERRORS.SAVE'));
          this.saving.set(false);
        },
      });
  }

  exportExcel(): void {
    if (!this.departmentId) return;
    this.stockApi
      .exportReport({
        departmentId: this.departmentId,
        categoryId: this.categoryId || undefined,
        year: this.year,
        blindCount: this.blindCount(),
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (blob) => {
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = this.blindCount()
            ? `Stock_Count_Sheet_${this.year}.xlsx`
            : `Stock_Report_${this.year}.xlsx`;
          a.click();
          window.URL.revokeObjectURL(url);
        },
        error: () => this.message.error(this.translate.instant('COMMON.EXPORT_FAILED')),
      });
  }

  onUploadFile(ev: Event): void {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file || !this.departmentId) return;
    this.uploading.set(true);
    const fd = new FormData();
    fd.append('file', file);
    fd.append('departmentId', this.departmentId);
    if (this.categoryId) fd.append('categoryId', this.categoryId);
    fd.append('year', String(this.year));
    this.stockApi
      .uploadCount(fd)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          if (res.report) {
            this.report.set(res.report);
            this.initLocalCounts(res.report);
          }
          this.message.success(
            this.translate.instant('STOCK_REPORT.MSG.UPLOAD_OK', {
              updated: res.updated ?? 0,
              skipped: res.skipped ?? 0,
            }),
          );
          this.uploading.set(false);
          input.value = '';
        },
        error: (e: { error?: { error?: string } }) => {
          this.message.error(e?.error?.error ?? this.translate.instant('STOCK_REPORT.ERRORS.UPLOAD'));
          this.uploading.set(false);
          input.value = '';
        },
      });
  }

  loadSaved(): void {
    this.savedLoading.set(true);
    this.stockApi
      .getSavedReports()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (rows) => {
          this.savedRows.set(rows);
          this.savedLoading.set(false);
        },
        error: () => {
          this.savedLoading.set(false);
        },
      });
  }

  setTab(tab: 'generate' | 'saved'): void {
    this.activeTab.set(tab);
    if (tab === 'saved') this.loadSaved();
  }

  fmt(n: unknown): string {
    return Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  fmtQty(n: unknown): string {
    return Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 4 });
  }

  showBook(n: unknown): string {
    if (this.blindCount()) return '';
    return this.fmtQty(n);
  }
}
