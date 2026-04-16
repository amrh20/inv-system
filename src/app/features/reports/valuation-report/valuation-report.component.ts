import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  computed,
  DestroyRef,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { LucideAngularModule } from 'lucide-angular';
import { Info, Search } from 'lucide-angular';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import type { CategoryRow } from '../../master-data/models/category.model';
import type { DepartmentRow } from '../../master-data/models/department.model';
import type { LocationRow } from '../../master-data/models/location.model';
import { CategoriesService } from '../../master-data/services/categories.service';
import { DepartmentsService } from '../../master-data/services/departments.service';
import { LocationsService } from '../../master-data/services/locations.service';
import type { ValuationPayload, ValuationRow } from '../models/report.models';
import { InventoryReportsService } from '../services/inventory-reports.service';

@Component({
  selector: 'app-valuation-report',
  standalone: true,
  imports: [
    DatePipe,
    FormsModule,
    NzButtonModule,
    NzDatePickerModule,
    NzSelectModule,
    NzSpinModule,
    TranslatePipe,
    LucideAngularModule,
    EmptyStateComponent,
  ],
  templateUrl: './valuation-report.component.html',
  styleUrls: ['./valuation-report.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ValuationReportComponent implements OnInit {
  private readonly reportsApi = inject(InventoryReportsService);
  private readonly departmentsApi = inject(DepartmentsService);
  private readonly locationsApi = inject(LocationsService);
  private readonly categoriesApi = inject(CategoriesService);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);

  readonly lucideSearch = Search;
  readonly lucideInfo = Info;

  readonly departments = signal<DepartmentRow[]>([]);
  readonly locations = signal<LocationRow[]>([]);
  readonly categories = signal<CategoryRow[]>([]);
  asOfDate = new Date();
  selectedDept = '';
  selectedLoc = '';
  selectedCat = '';
  readonly loading = signal(false);
  readonly queried = signal(false);
  readonly error = signal<string | null>(null);
  rows = signal<ValuationRow[]>([]);
  totalValue = signal(0);
  snapshotUsed = signal<{ id: string; year: number; month?: number | null; closedAt: string } | null>(null);

  readonly filteredLocations = computed(() => {
    const dept = this.selectedDept;
    const locs = this.locations();
    if (!dept) return locs;
    return locs.filter((l) => l.departmentId === dept);
  });

  readonly groupedRows = computed(() => {
    const g: Record<string, ValuationRow[]> = {};
    for (const r of this.rows()) {
      const dept = r['department'] ?? '(—)';
      const key = String(dept);
      if (!g[key]) g[key] = [];
      g[key].push(r);
    }
    return g;
  });

  readonly groupedEntries = computed(() => {
    const g = this.groupedRows();
    return Object.keys(g).map((k) => ({ key: k, rows: g[k]! }));
  });

  ngOnInit(): void {
    this.departmentsApi
      .list({ take: 200 })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((r) => this.departments.set(r.departments));
    this.locationsApi
      .list({ take: 300 })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((r) => this.locations.set(r.locations));
    this.categoriesApi
      .list({ take: 200 })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((r) => this.categories.set(r.categories));
  }

  onDeptChange(): void {
    this.selectedLoc = '';
  }

  run(): void {
    const asOf = this.toIso(this.asOfDate);
    if (!asOf) {
      this.message.error(this.translate.instant('REPORTS.VALUATION.ERRORS.DATE'));
      return;
    }
    this.loading.set(true);
    this.error.set(null);
    this.queried.set(false);
    this.reportsApi
      .getValuation({
        asOfDate: asOf,
        ...(this.selectedDept ? { departmentIds: this.selectedDept } : {}),
        ...(this.selectedLoc ? { locationIds: this.selectedLoc } : {}),
        ...(this.selectedCat ? { categoryId: this.selectedCat } : {}),
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data: ValuationPayload) => {
          this.rows.set(data.rows ?? []);
          this.totalValue.set(Number(data.totalValue ?? 0));
          this.snapshotUsed.set(
            (data.snapshotUsed as { id: string; year: number; month?: number | null; closedAt: string } | null) ?? null,
          );
          this.queried.set(true);
          this.loading.set(false);
          this.cdr.markForCheck();
        },
        error: (e: Error) => {
          this.error.set(e.message);
          this.loading.set(false);
          this.cdr.markForCheck();
        },
      });
  }

  exportExcel(): void {
    const asOf = this.toIso(this.asOfDate);
    if (!asOf) return;
    this.reportsApi
      .downloadValuationExcel({
        asOfDate: asOf,
        ...(this.selectedDept ? { departmentIds: this.selectedDept } : {}),
        ...(this.selectedLoc ? { locationIds: this.selectedLoc } : {}),
        ...(this.selectedCat ? { categoryId: this.selectedCat } : {}),
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (blob) => {
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `Valuation_${asOf}.xlsx`;
          a.click();
          window.URL.revokeObjectURL(url);
        },
        error: () => this.message.error(this.translate.instant('COMMON.EXPORT_FAILED')),
      });
  }

  fmt(n: unknown): string {
    return Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  fmtQty(n: unknown): string {
    return Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 });
  }

  deptGroupTotal(rs: ValuationRow[]): number {
    return rs.reduce((s, r) => s + Number(r['totalValue'] ?? 0), 0);
  }

  totalQtyOnHand(): number {
    return this.rows().reduce((s, r) => s + Number(r['qtyOnHand'] ?? 0), 0);
  }

  toIso(d: Date | null): string {
    if (!d) return '';
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  padMonth(m: number | null | undefined): string {
    if (m == null) return '';
    return String(m).padStart(2, '0');
  }
}
