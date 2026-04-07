import { NgClass } from '@angular/common';
import {
  Component,
  computed,
  DestroyRef,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { debounceTime, first } from 'rxjs/operators';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import type { NzTableSortFn } from 'ng-zorro-antd/table';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { LucideAngularModule } from 'lucide-angular';
import {
  AlertTriangle,
  Building2,
  DollarSign,
  Download,
  Loader2,
  MapPin,
  Package,
  RefreshCw,
  Search,
  TrendingDown,
  X,
} from 'lucide-angular';
import type { CategoryOption, DepartmentOption, LocationOption } from '../../items/models/item.models';
import { CategoriesService } from '../../items/services/categories.service';
import { ItemMasterLookupsService } from '../../items/services/item-master-lookups.service';
import type {
  StockBalanceRow,
  StockBalancesParams,
  StockBalancesSummary,
  StockReorderStatus,
} from '../models/stock-balance.model';
import { StockService } from '../services/stock.service';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';

const TAKE = 100;

@Component({
  selector: 'app-stock-balances',
  standalone: true,
  imports: [
    NgClass,
    FormsModule,
    NzAlertModule,
    NzButtonModule,
    NzInputModule,
    NzSelectModule,
    NzTableModule,
    TranslatePipe,
    LucideAngularModule,
    EmptyStateComponent,
  ],
  templateUrl: './stock-balances.component.html',
  styleUrl: './stock-balances.component.scss',
})
export class StockBalancesComponent implements OnInit {
  readonly pageSize = TAKE;

  private readonly stockApi = inject(StockService);
  private readonly categoriesApi = inject(CategoriesService);
  private readonly lookups = inject(ItemMasterLookupsService);
  private readonly message = inject(NzMessageService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly translate = inject(TranslateService);

  private readonly reload$ = new Subject<void>();

  readonly lucideRefresh = RefreshCw;
  readonly lucideDownload = Download;
  readonly lucideSearch = Search;
  readonly lucideX = X;
  readonly lucidePackage = Package;
  readonly lucideLoader = Loader2;
  readonly lucideMapPin = MapPin;
  readonly lucideBuilding = Building2;
  readonly lucideAlert = AlertTriangle;
  readonly lucideTrendDown = TrendingDown;
  readonly lucideDollar = DollarSign;

  readonly balances = signal<StockBalanceRow[]>([]);
  readonly totalRows = signal(0);
  readonly loading = signal(false);
  readonly listError = signal('');
  readonly summary = signal<StockBalancesSummary | null>(null);
  readonly summaryLoading = signal(false);
  readonly exporting = signal(false);

  readonly searchDraft = signal('');
  readonly departmentId = signal('');
  readonly locationId = signal('');
  readonly categoryId = signal('');
  /** `'false'` = non-zero only, `'true'` = include zeros */
  readonly showZero = signal('false');

  readonly categories = signal<CategoryOption[]>([]);
  readonly departments = signal<DepartmentOption[]>([]);
  readonly locations = signal<LocationOption[]>([]);

  readonly filteredLocations = computed(() => {
    const dept = this.departmentId();
    const locs = this.locations();
    if (!dept) {
      return locs;
    }
    return locs.filter((l) => l.departmentId === dept);
  });

  readonly pageTotals = computed(() =>
    this.balances().reduce(
      (acc, b) => {
        const qty = Number(b.qtyOnHand);
        const val = qty * Number(b.wacUnitCost ?? 0);
        return { qty: acc.qty + qty, value: acc.value + val };
      },
      { qty: 0, value: 0 },
    ),
  );

  readonly hasFilters = computed(() => {
    return !!(
      this.searchDraft().trim() ||
      this.departmentId() ||
      this.locationId() ||
      this.categoryId() ||
      this.showZero() !== 'false'
    );
  });

  readonly sortItemFn: NzTableSortFn<StockBalanceRow> = (a, b) =>
    (a.item?.name ?? '').localeCompare(b.item?.name ?? '', undefined, { sensitivity: 'base' });

  readonly sortBarcodeFn: NzTableSortFn<StockBalanceRow> = (a, b) =>
    (a.item?.barcode ?? '').localeCompare(b.item?.barcode ?? '', undefined, { sensitivity: 'base' });

  readonly sortCategoryFn: NzTableSortFn<StockBalanceRow> = (a, b) =>
    (a.item?.category?.name ?? '').localeCompare(b.item?.category?.name ?? '', undefined, {
      sensitivity: 'base',
    });

  readonly sortDepartmentFn: NzTableSortFn<StockBalanceRow> = (a, b) =>
    (a.item?.department?.name ?? '').localeCompare(b.item?.department?.name ?? '', undefined, {
      sensitivity: 'base',
    });

  readonly sortLocationFn: NzTableSortFn<StockBalanceRow> = (a, b) =>
    (a.location?.name ?? '').localeCompare(b.location?.name ?? '', undefined, { sensitivity: 'base' });

  readonly sortQtyFn: NzTableSortFn<StockBalanceRow> = (a, b) =>
    Number(a.qtyOnHand) - Number(b.qtyOnHand);

  readonly sortTotalValueFn: NzTableSortFn<StockBalanceRow> = (a, b) =>
    this.lineValue(a) - this.lineValue(b);

  ngOnInit(): void {
    this.reload$
      .pipe(debounceTime(300), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.loadBalances();
        this.loadSummary();
      });

    this.loadFilterOptions();
    this.reload$.next();
  }

  onSearchInput(value: string): void {
    this.searchDraft.set(value);
    this.reload$.next();
  }

  onFilterChange(): void {
    this.reload$.next();
  }

  onDepartmentChange(): void {
    this.locationId.set('');
    this.reload$.next();
  }

  clearFilters(): void {
    this.searchDraft.set('');
    this.departmentId.set('');
    this.locationId.set('');
    this.categoryId.set('');
    this.showZero.set('false');
    this.reload$.next();
  }

  refreshNow(): void {
    this.loadBalances();
    this.loadSummary();
  }

  exportExcel(): void {
    if (this.balances().length === 0) {
      return;
    }
    this.exporting.set(true);
    this.stockApi
      .exportStockBalances(this.buildQueryParams())
      .pipe(first())
      .subscribe({
        next: (blob) => {
          this.exporting.set(false);
          const d = new Date().toISOString().split('T')[0];
          this.saveBlob(blob, `stock-balances-${d}.xlsx`);
        },
        error: () => {
          this.exporting.set(false);
          this.message.error(this.t('COMMON.EXPORT_FAILED'));
        },
      });
  }

  rowReorderStatus(row: StockBalanceRow): StockReorderStatus {
    const qty = Number(row.qtyOnHand);
    const reorder = Number(row.item?.reorderPoint ?? 0);
    if (qty === 0) {
      return 'out_of_stock';
    }
    if (reorder > 0 && qty < reorder) {
      return 'low_stock';
    }
    return 'in_stock';
  }

  rowStatusClass(row: StockBalanceRow): Record<string, boolean> {
    const s = this.rowReorderStatus(row);
    return {
      'stock-row--out': s === 'out_of_stock',
      'stock-row--low': s === 'low_stock',
    };
  }

  statusLabel(s: StockReorderStatus): string {
    switch (s) {
      case 'out_of_stock':
        return this.t('STOCK.STATUS_OUT_OF_STOCK');
      case 'low_stock':
        return this.t('STOCK.STATUS_LOW_STOCK');
      default:
        return this.t('STOCK.STATUS_IN_STOCK');
    }
  }

  showLowStockBanner(): boolean {
    if (this.summaryLoading()) {
      return false;
    }
    return Number(this.summary()?.lowStockCount ?? 0) > 0;
  }

  statusClass(s: StockReorderStatus): string {
    switch (s) {
      case 'out_of_stock':
        return 'out-of-stock';
      case 'low_stock':
        return 'low-stock';
      default:
        return 'in-stock';
    }
  }

  formatQty(n: string | number | undefined): string {
    return Number(n ?? 0).toLocaleString('en-US', { maximumFractionDigits: 2 });
  }

  formatMoney(n: string | number | undefined): string {
    return Number(n ?? 0).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  /** Line value = qty × WAC (matches page footer totals). */
  lineValue(row: StockBalanceRow): number {
    return Number(row.qtyOnHand ?? 0) * Number(row.wacUnitCost ?? 0);
  }

  isNegativeQty(row: StockBalanceRow): boolean {
    return Number(row.qtyOnHand) < 0;
  }

  private loadBalances(): void {
    this.loading.set(true);
    this.listError.set('');
    this.stockApi
      .getStockBalances(this.buildQueryParams())
      .pipe(first())
      .subscribe({
        next: (res) => {
          this.balances.set(res.balances);
          this.totalRows.set(res.total);
          this.loading.set(false);
        },
        error: (err: { error?: { message?: string } }) => {
          this.loading.set(false);
          this.listError.set(err?.error?.message ?? this.t('STOCK.ERROR_LOAD'));
        },
      });
  }

  private loadSummary(): void {
    this.summaryLoading.set(true);
    this.stockApi
      .getSummary(this.buildQueryParams())
      .pipe(first())
      .subscribe({
        next: (s) => {
          this.summary.set(s);
          this.summaryLoading.set(false);
        },
        error: () => {
          this.summary.set(null);
          this.summaryLoading.set(false);
        },
      });
  }

  private buildQueryParams(): StockBalancesParams {
    return {
      take: TAKE,
      search: this.searchDraft().trim() || undefined,
      departmentId: this.departmentId() || undefined,
      locationId: this.locationId() || undefined,
      categoryId: this.categoryId() || undefined,
      showZero: this.showZero(),
    };
  }

  private loadFilterOptions(): void {
    this.categoriesApi
      .list({ take: 200 })
      .pipe(first())
      .subscribe({ next: (c) => this.categories.set(c), error: () => this.categories.set([]) });
    this.lookups
      .listDepartments({ take: 200 })
      .pipe(first())
      .subscribe({ next: (d) => this.departments.set(d), error: () => this.departments.set([]) });
    this.lookups
      .listLocations({ take: 200 })
      .pipe(first())
      .subscribe({ next: (l) => this.locations.set(l), error: () => this.locations.set([]) });
  }

  private saveBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  private t(key: string, params?: Record<string, unknown>): string {
    return this.translate.instant(key, params);
  }
}
