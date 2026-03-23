import { DatePipe } from '@angular/common';
import { Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTableModule } from 'ng-zorro-antd/table';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { LucideAngularModule } from 'lucide-angular';
import {
  BarChart3,
  Building2,
  Calendar,
  Clock,
  FileSpreadsheet,
  FileText,
  History,
  Package,
  Printer,
  Search,
  TrendingDown,
  TrendingUp,
  ArrowLeftRight,
} from 'lucide-angular';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import type { CategoryRow } from '../../master-data/models/category.model';
import type { DepartmentRow } from '../../master-data/models/department.model';
import type { EngineReportType, GeneratedReport } from '../models/report.models';
import { InventoryReportsService } from '../services/inventory-reports.service';
import { CategoriesService } from '../../master-data/services/categories.service';
import { DepartmentsService } from '../../master-data/services/departments.service';
import { DetailReportTableComponent, type DetailReportRow } from './report-views/detail-report-table.component';

@Component({
  selector: 'app-report-engine',
  standalone: true,
  imports: [
    DatePipe,
    FormsModule,
    NzButtonModule,
    NzDatePickerModule,
    NzSelectModule,
    NzSpinModule,
    NzTableModule,
    TranslatePipe,
    LucideAngularModule,
    EmptyStateComponent,
    DetailReportTableComponent,
  ],
  templateUrl: './report-engine.component.html',
  styleUrl: './report-engine.component.scss',
})
export class ReportEngineComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly reportsApi = inject(InventoryReportsService);
  private readonly departmentsApi = inject(DepartmentsService);
  private readonly categoriesApi = inject(CategoriesService);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);

  readonly lucideCalendar = Calendar;
  readonly lucideBuilding = Building2;
  readonly lucideSearch = Search;
  readonly lucideHistory = History;
  readonly lucidePrint = Printer;
  readonly lucideExcel = FileSpreadsheet;
  readonly lucidePdf = FileText;
  readonly lucidePackage = Package;
  readonly lucideBar = BarChart3;
  readonly lucideUp = TrendingUp;
  readonly lucideDown = TrendingDown;
  readonly lucideArrow = ArrowLeftRight;
  readonly lucideClock = Clock;

  reportType!: EngineReportType;
  departmentList: DepartmentRow[] = [];
  categories: CategoryRow[] = [];
  selectedDeptIds: string[] = [];
  categoryId = '';
  startDate = this.firstOfMonth();
  endDate = new Date();
  generating = false;
  viewMode: 'filters' | 'result' = 'filters';
  activeReport: GeneratedReport | null = null;

  ngOnInit(): void {
    const rt = this.route.snapshot.data['reportType'] as EngineReportType | undefined;
    this.reportType = rt ?? 'DETAIL';
    this.departmentsApi
      .list({ take: 200, isActive: true })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((r) => {
        this.departmentList = r.departments;
        this.loadCategories();
      });
  }

  titleKey(): string {
    const map: Record<EngineReportType, string> = {
      DETAIL: 'REPORTS.ENGINE.TITLES.DETAIL',
      BREAKAGE: 'REPORTS.ENGINE.TITLES.BREAKAGE',
      OMC: 'REPORTS.ENGINE.TITLES.OMC',
      TRANSFERS: 'REPORTS.ENGINE.TITLES.TRANSFERS',
      AGING: 'REPORTS.ENGINE.TITLES.AGING',
    };
    return map[this.reportType] ?? 'REPORTS.ENGINE.TITLES.DETAIL';
  }

  onDeptChange(): void {
    this.loadCategories();
  }

  private loadCategories(): void {
    const params: { take: number; departmentIds?: string } = { take: 200 };
    if (this.selectedDeptIds.length) params.departmentIds = this.selectedDeptIds.join(',');
    this.categoriesApi
      .list(params)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((r) => {
        this.categories = r.categories;
        this.categoryId = '';
      });
  }

  generate(): void {
    const s = this.toIso(this.startDate);
    const e = this.toIso(this.endDate);
    if (!s || !e) {
      this.message.error(this.translate.instant('REPORTS.ERRORS.DATE_RANGE'));
      return;
    }
    this.generating = true;
    this.reportsApi
      .generate({
        reportType: this.reportType,
        departmentIds: this.selectedDeptIds,
        startDate: s,
        endDate: e,
        ...(this.categoryId ? { categoryId: this.categoryId } : {}),
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (rep) => {
          this.activeReport = rep;
          this.viewMode = 'result';
          this.generating = false;
          this.message.success(this.translate.instant('REPORTS.MSG.GENERATED'));
        },
        error: (err: Error) => {
          this.message.error(err.message || this.translate.instant('REPORTS.MSG.GENERATE_FAILED'));
          this.generating = false;
        },
      });
  }

  backToFilters(): void {
    this.viewMode = 'filters';
    this.activeReport = null;
  }

  print(): void {
    setTimeout(() => window.print(), 100);
  }

  downloadExcel(): void {
    const id = this.activeReport?.id;
    if (!id) return;
    this.reportsApi.exportExcel(id).subscribe({
      next: (blob) => this.saveBlob(blob, `Report_${this.reportType}_${Date.now()}.xlsx`),
      error: () => this.message.error(this.translate.instant('COMMON.EXPORT_FAILED')),
    });
  }

  downloadPdf(): void {
    const id = this.activeReport?.id;
    if (!id) return;
    this.reportsApi.exportPdf(id).subscribe({
      next: (blob) => this.saveBlob(blob, `Report_${this.reportType}_${Date.now()}.pdf`),
      error: () => this.message.error(this.translate.instant('COMMON.EXPORT_FAILED')),
    });
  }

  detailRows(): DetailReportRow[] {
    const rows = (this.activeReport?.data?.rows ?? []) as DetailReportRow[];
    return Array.isArray(rows) ? rows : [];
  }

  detailLocations(): { id: string; name: string }[] {
    return this.activeReport?.data?.locations ?? [];
  }

  rowsGeneric(): Record<string, unknown>[] {
    return (this.activeReport?.data?.rows ?? []) as Record<string, unknown>[];
  }

  fmt(n: unknown): string {
    return Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  fmtQty(n: unknown): string {
    return Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 4 });
  }

  private saveBlob(blob: Blob, filename: string): void {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  }

  private firstOfMonth(): Date {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  }

  private toIso(d: Date | null): string {
    if (!d) return '';
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  formatRange(start: string, end: string): string {
    return `${new Date(start).toLocaleDateString()} → ${new Date(end).toLocaleDateString()}`;
  }

  omcIn(r: Record<string, unknown>): number {
    const inQty = Number(r['inQty'] ?? 0);
    const obQty = Number(r['obQty'] ?? 0);
    const tfrInQty = Number(r['tfrInQty'] ?? 0);
    const adj = Number(r['adjQty'] ?? 0);
    return inQty + obQty + tfrInQty + (adj > 0 ? adj : 0);
  }

  omcOut(r: Record<string, unknown>): number {
    const outQty = Number(r['outQty'] ?? 0);
    const tfrOutQty = Number(r['tfrOutQty'] ?? 0);
    const adj = Number(r['adjQty'] ?? 0);
    return outQty + tfrOutQty + (adj < 0 ? Math.abs(adj) : 0);
  }
}
