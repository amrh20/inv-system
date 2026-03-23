import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { LucideAngularModule } from 'lucide-angular';
import { AlertTriangle, Building2, Calendar, FileSpreadsheet, Info, Printer, Search, X } from 'lucide-angular';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import type { CategoryRow } from '../../master-data/models/category.model';
import type { DepartmentRow } from '../../master-data/models/department.model';
import { CategoriesService } from '../../master-data/services/categories.service';
import { DepartmentsService } from '../../master-data/services/departments.service';
import type { SummaryInventoryRow, SummaryInventoryTotals } from '../models/report.models';
import { InventoryReportsService } from '../services/inventory-reports.service';

interface ColSub {
  k: string;
  labelKey: string;
  isVal?: boolean;
  signed?: boolean;
}

interface ColGroup {
  id: string;
  labelKey: string;
  headerClass: string;
  sub: ColSub[];
}

@Component({
  selector: 'app-summary-inventory-report',
  standalone: true,
  imports: [
    FormsModule,
    NzButtonModule,
    NzDatePickerModule,
    NzSelectModule,
    NzSpinModule,
    TranslatePipe,
    LucideAngularModule,
    EmptyStateComponent,
  ],
  templateUrl: './summary-inventory-report.component.html',
  styleUrl: './summary-inventory-report.component.scss',
})
export class SummaryInventoryReportComponent implements OnInit {
  private readonly reportsApi = inject(InventoryReportsService);
  private readonly departmentsApi = inject(DepartmentsService);
  private readonly categoriesApi = inject(CategoriesService);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);

  readonly lucideCalendar = Calendar;
  readonly lucideBuilding = Building2;
  readonly lucideSearch = Search;
  readonly lucideFile = FileSpreadsheet;
  readonly lucideAlert = AlertTriangle;
  readonly lucideInfo = Info;
  readonly lucidePrint = Printer;
  readonly lucideX = X;

  readonly departments = signal<DepartmentRow[]>([]);
  readonly categories = signal<CategoryRow[]>([]);
  /** Bound to nz-select multiple (ngModel cannot bind to WritableSignal). */
  selectedDeptIds: string[] = [];
  categoryId = '';
  readonly startDate = signal<Date>(this.firstOfMonth());
  readonly endDate = signal<Date>(new Date());
  readonly loading = signal(false);
  readonly queried = signal(false);
  readonly error = signal<string | null>(null);
  readonly reportRows = signal<SummaryInventoryRow[]>([]);
  readonly totals = signal<SummaryInventoryTotals | null>(null);
  readonly periodLabel = signal<string>('');
  readonly hasPhysical = signal(false);

  readonly colGroups: ColGroup[] = [
    {
      id: 'open',
      labelKey: 'REPORTS.SUMMARY.COLUMNS.OPENING_STOCK',
      headerClass: 'bg-gray-700',
      sub: [
        { k: 'openQty', labelKey: 'REPORTS.SUMMARY.COLUMNS.QTY' },
        { k: 'openVal', labelKey: 'REPORTS.SUMMARY.COLUMNS.VALUE_SAR', isVal: true },
      ],
    },
    {
      id: 'grn',
      labelKey: 'REPORTS.SUMMARY.COLUMNS.PURCHASES_GRN',
      headerClass: 'bg-blue-700',
      sub: [
        { k: 'grnQty', labelKey: 'REPORTS.SUMMARY.COLUMNS.QTY' },
        { k: 'grnVal', labelKey: 'REPORTS.SUMMARY.COLUMNS.VALUE_SAR', isVal: true },
      ],
    },
    {
      id: 'brk',
      labelKey: 'REPORTS.SUMMARY.COLUMNS.BREAKAGE',
      headerClass: 'bg-orange-700',
      sub: [
        { k: 'brkQty', labelKey: 'REPORTS.SUMMARY.COLUMNS.QTY' },
        { k: 'brkVal', labelKey: 'REPORTS.SUMMARY.COLUMNS.VALUE_SAR', isVal: true },
      ],
    },
    {
      id: 'pass',
      labelKey: 'REPORTS.SUMMARY.COLUMNS.GATE_PASS',
      headerClass: 'bg-yellow-700',
      sub: [
        { k: 'passQty', labelKey: 'REPORTS.SUMMARY.COLUMNS.QTY' },
        { k: 'passVal', labelKey: 'REPORTS.SUMMARY.COLUMNS.VALUE_SAR', isVal: true },
      ],
    },
    {
      id: 'theor',
      labelKey: 'REPORTS.SUMMARY.COLUMNS.THEORETICAL_BALANCE',
      headerClass: 'bg-indigo-700',
      sub: [
        { k: 'theorQty', labelKey: 'REPORTS.SUMMARY.COLUMNS.QTY' },
        { k: 'theorVal', labelKey: 'REPORTS.SUMMARY.COLUMNS.VALUE_SAR', isVal: true },
      ],
    },
    {
      id: 'phys',
      labelKey: 'REPORTS.SUMMARY.COLUMNS.PHYSICAL_COUNT',
      headerClass: 'bg-emerald-700',
      sub: [
        { k: 'physQty', labelKey: 'REPORTS.SUMMARY.COLUMNS.QTY' },
        { k: 'physVal', labelKey: 'REPORTS.SUMMARY.COLUMNS.VALUE_SAR', isVal: true },
      ],
    },
    {
      id: 'var',
      labelKey: 'REPORTS.SUMMARY.COLUMNS.COUNT_VARIANCE',
      headerClass: 'bg-red-700',
      sub: [
        { k: 'varQty', labelKey: 'REPORTS.SUMMARY.COLUMNS.QTY', signed: true },
        { k: 'varVal', labelKey: 'REPORTS.SUMMARY.COLUMNS.VALUE_SAR', isVal: true, signed: true },
      ],
    },
    {
      id: 'close',
      labelKey: 'REPORTS.SUMMARY.COLUMNS.CLOSING_BALANCE',
      headerClass: 'bg-teal-700',
      sub: [
        { k: 'closeQty', labelKey: 'REPORTS.SUMMARY.COLUMNS.QTY' },
        { k: 'closeVal', labelKey: 'REPORTS.SUMMARY.COLUMNS.VALUE_SAR', isVal: true },
      ],
    },
  ];

  ngOnInit(): void {
    this.departmentsApi
      .list({ take: 200, isActive: true })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((r) => {
        this.departments.set(r.departments);
        this.loadCategories();
      });
  }

  onDepartmentsChange(ids: string[]): void {
    this.selectedDeptIds = ids;
    this.loadCategories();
  }

  private loadCategories(): void {
    const ids = this.selectedDeptIds;
    const params: { take: number; departmentIds?: string } = { take: 200 };
    if (ids.length) params.departmentIds = ids.join(',');
    this.categoriesApi
      .list(params)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((r) => {
        this.categories.set(r.categories);
        this.categoryId = '';
      });
  }

  generate(): void {
    const s = this.toIsoDate(this.startDate());
    const e = this.toIsoDate(this.endDate());
    if (!s || !e) {
      this.message.error(this.translate.instant('REPORTS.ERRORS.DATE_RANGE'));
      return;
    }
    this.loading.set(true);
    this.error.set(null);
    this.queried.set(true);
    const deptIds = this.selectedDeptIds;
    this.reportsApi
      .getSummaryInventory({
        startDate: s,
        endDate: e,
        ...(deptIds.length ? { departmentIds: deptIds.join(',') } : {}),
        ...(this.categoryId ? { categoryId: this.categoryId } : {}),
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => {
          this.reportRows.set(data.rows ?? []);
          this.totals.set(data.totals ?? null);
          this.hasPhysical.set(!!data.hasPhysical);
          const p = data.period;
          this.periodLabel.set(
            p
              ? `${this.fmtDate(p.startDate)} → ${this.fmtDate(p.endDate)}`
              : `${this.fmtDate(s)} → ${this.fmtDate(e)}`,
          );
          this.loading.set(false);
        },
        error: (err: Error) => {
          this.error.set(err.message || 'Error');
          this.loading.set(false);
        },
      });
  }

  removeDept(id: string): void {
    this.selectedDeptIds = this.selectedDeptIds.filter((x) => x !== id);
    this.loadCategories();
  }

  print(): void {
    window.print();
  }

  fmt(n: unknown, isVal = false): string {
    if (n == null || n === '') return '—';
    const num = Number(n);
    if (Number.isNaN(num)) return '—';
    return isVal
      ? num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : num.toLocaleString(undefined, { maximumFractionDigits: 0 });
  }

  cellClass(v: unknown, signed?: boolean): string {
    if (!signed || v == null) return '';
    const n = Number(v);
    if (n < 0) return 'text-red-600 font-semibold';
    if (n > 0) return 'text-emerald-700 font-semibold';
    return '';
  }

  prefix(v: unknown, signed?: boolean): string {
    if (!signed || v == null) return '';
    const n = Number(v);
    return n > 0 ? '+' : '';
  }

  private firstOfMonth(): Date {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  }

  private toIsoDate(d: Date | null): string {
    if (!d) return '';
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  private fmtDate(iso: string): string {
    return new Date(iso).toLocaleDateString();
  }
}
