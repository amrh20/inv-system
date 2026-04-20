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
import { NzPaginationModule } from 'ng-zorro-antd/pagination';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTooltipModule } from 'ng-zorro-antd/tooltip';
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
import { ItemsService } from '../../items/services/items.service';
import type { RequirementsResponse } from '../../items/models/item.model';
import type {
  StockBalanceRow,
  StockBalancesParams,
  StockBalancesSummary,
  StockReorderStatus,
} from '../models/stock-balance.model';
import { StockService } from '../services/stock.service';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { injectMatchMinWidth } from '../../../shared/utils/viewport-media';

/** Page size options for stock balances table (must match template `nzPageSizeOptions`). */
const PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const;

@Component({
  selector: 'app-stock-balances',
  standalone: true,
  imports: [
    NgClass,
    FormsModule,
    NzAlertModule,
    NzButtonModule,
    NzInputModule,
    NzPaginationModule,
    NzSelectModule,
    NzTableModule,
    NzTooltipModule,
    TranslatePipe,
    LucideAngularModule,
    EmptyStateComponent,
  ],
  templateUrl: './stock-balances.component.html',
  styleUrl: './stock-balances.component.scss',
})
export class StockBalancesComponent implements OnInit {
  private static readonly DEFAULT_OB_STATUS: NonNullable<RequirementsResponse['obStatus']> = 'FINALIZED';

  readonly pageSizeOptions: number[] = [...PAGE_SIZE_OPTIONS];

  private readonly stockApi = inject(StockService);
  private readonly categoriesApi = inject(CategoriesService);
  private readonly lookups = inject(ItemMasterLookupsService);
  private readonly itemsApi = inject(ItemsService);
  private readonly message = inject(NzMessageService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly translate = inject(TranslateService);

  /** Desktop: wrap cells; mobile: `[nzScroll]` min width + wrapper horizontal scroll. */
  private readonly viewportIsDesktop = injectMatchMinWidth(768);

  readonly nzTableScroll = computed(() =>
    this.viewportIsDesktop() ? {} : { x: '1680px' },
  );

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
  readonly obStatus = signal<NonNullable<RequirementsResponse['obStatus']>>(
    StockBalancesComponent.DEFAULT_OB_STATUS,
  );

  readonly searchDraft = signal('');
  readonly departmentId = signal('');
  readonly locationId = signal('');
  readonly categoryId = signal('');
  /** `'false'` = non-zero only, `'true'` = include zeros */
  readonly showZero = signal('false');

  /** 1-based page index for `nz-pagination`. */
  readonly pageIndex = signal(1);
  readonly pageSize = signal(20);

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
  readonly showSetupInProgress = computed(
    () => this.obStatus() === 'OPEN' || this.obStatus() === 'INITIAL_LOCK',
  );
  readonly canRenderStockBalances = computed(() => this.obStatus() === 'FINALIZED');

  readonly pageTotals = computed(() =>
    this.balances().reduce(
      (acc, b) => {
        const qty = this.availableQty(b);
        const val = qty * Number(b.wacUnitCost ?? 0);
        return {
          qty: acc.qty + qty,
          value: acc.value + val,
          blocked: acc.blocked + Number(b.qtyBlocked ?? 0),
          lost: acc.lost + this.lossQty(b),
          damage: acc.damage + this.damageQty(b),
        };
      },
      { qty: 0, value: 0, blocked: 0, lost: 0, damage: 0 },
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
    this.displayItemName(a).localeCompare(this.displayItemName(b), undefined, { sensitivity: 'base' });

  readonly sortBarcodeFn: NzTableSortFn<StockBalanceRow> = (a, b) =>
    this.displayBarcode(a).localeCompare(this.displayBarcode(b), undefined, { sensitivity: 'base' });

  readonly sortCategoryFn: NzTableSortFn<StockBalanceRow> = (a, b) =>
    this.displayCategoryName(a).localeCompare(this.displayCategoryName(b), undefined, {
      sensitivity: 'base',
    });

  readonly sortDepartmentFn: NzTableSortFn<StockBalanceRow> = (a, b) =>
    this.displayDepartmentName(a).localeCompare(this.displayDepartmentName(b), undefined, {
      sensitivity: 'base',
    });

  readonly sortLocationFn: NzTableSortFn<StockBalanceRow> = (a, b) =>
    (a.location?.name ?? '').localeCompare(b.location?.name ?? '', undefined, { sensitivity: 'base' });

  readonly sortQtyFn: NzTableSortFn<StockBalanceRow> = (a, b) =>
    this.availableQty(a) - this.availableQty(b);

  readonly sortLostFn: NzTableSortFn<StockBalanceRow> = (a, b) => this.lossQty(a) - this.lossQty(b);

  readonly sortDamageFn: NzTableSortFn<StockBalanceRow> = (a, b) =>
    this.damageQty(a) - this.damageQty(b);

  readonly sortTotalValueFn: NzTableSortFn<StockBalanceRow> = (a, b) =>
    this.lineValue(a) - this.lineValue(b);

  ngOnInit(): void {
    this.loadRequirements();
    this.reload$
      .pipe(debounceTime(300), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.pageIndex.set(1);
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
    if (!this.canRenderStockBalances()) {
      return;
    }
    this.loadBalances();
    this.loadSummary();
  }

  exportExcel(): void {
    if (!this.canRenderStockBalances()) {
      return;
    }
    if (this.totalRows() === 0) {
      return;
    }
    this.exporting.set(true);
    this.stockApi
      .exportStockBalances(this.buildFilterParams())
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
    const reorder = Number(row.reorderPoint ?? row.item?.reorderPoint ?? 0);
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

  isPendingCategorization(row: StockBalanceRow): boolean {
    return row.pendingCategorization === true;
  }

  displayItemName(row: StockBalanceRow): string {
    return row.displayName?.trim() || row.item?.name?.trim() || '—';
  }

  displayBarcode(row: StockBalanceRow): string {
    return row.displayBarcode?.trim() || row.item?.barcode?.trim() || '—';
  }

  displayCategoryName(row: StockBalanceRow): string {
    if (row.displayCategoryName?.trim()) {
      return row.displayCategoryName.trim();
    }
    if (this.isPendingCategorization(row)) {
      return this.t('STOCK.PENDING_CATEGORIZATION');
    }
    return row.item?.category?.name?.trim() || this.t('COMMON.UNCATEGORIZED');
  }

  displayDepartmentName(row: StockBalanceRow): string {
    return row.displayDepartmentName?.trim() || row.item?.department?.name?.trim() || '';
  }

  statusBadgeClass(row: StockBalanceRow): string {
    if (this.isPendingCategorization(row)) {
      return 'status-pending';
    }
    return 'status-' + this.statusClass(this.rowReorderStatus(row));
  }

  statusBadgeLabel(row: StockBalanceRow): string {
    if (this.isPendingCategorization(row)) {
      return this.t('STOCK.PENDING_CATEGORIZATION');
    }
    return this.statusLabel(this.rowReorderStatus(row));
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
    return this.availableQty(row) < 0;
  }

  lossQty(row: StockBalanceRow): number {
    return Number(row.totalQtyLost ?? 0);
  }

  damageQty(row: StockBalanceRow): number {
    return Number(row.totalQtyDamage ?? 0);
  }

  /**
   * Sellable / usable quantity: on-hand minus blocked reservations.
   * Finalized breakage/lost postings already reduced `qtyOnHand` when stock was deducted; cumulative
   * lost/damage columns are for audit and are not subtracted again here.
   */
  availableQty(row: StockBalanceRow): number {
    const onHand = Number(row.qtyOnHand ?? 0);
    const blocked = Number(row.qtyBlocked ?? 0);
    return onHand - blocked;
  }

  /** Params for `STOCK.PAGE_ROW_RANGE` (1-based inclusive range on current page). */
  pageRowRangeParams(): { start: number; end: number; total: number } {
    const total = this.totalRows();
    if (total <= 0) {
      return { start: 0, end: 0, total: 0 };
    }
    const size = this.pageSize();
    const page = this.pageIndex();
    const start = (page - 1) * size + 1;
    const end = Math.min(page * size, total);
    return { start, end, total };
  }

  onPageIndexChange(page: number): void {
    this.pageIndex.set(page);
    this.loadBalances();
  }

  onPageSizeChange(size: number): void {
    this.pageSize.set(size);
    this.pageIndex.set(1);
    this.loadBalances();
  }

  private loadBalances(): void {
    if (!this.canRenderStockBalances()) {
      this.balances.set([]);
      this.totalRows.set(0);
      this.loading.set(false);
      return;
    }
    this.loading.set(true);
    this.listError.set('');
    this.stockApi
      .getStockBalances(this.buildListParams())
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
    if (!this.canRenderStockBalances()) {
      this.summary.set(null);
      this.summaryLoading.set(false);
      return;
    }
    this.summaryLoading.set(true);
    this.stockApi
      .getSummary(this.buildFilterParams())
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

  private buildFilterParams(): StockBalancesParams {
    return {
      search: this.searchDraft().trim() || undefined,
      departmentId: this.departmentId() || undefined,
      locationId: this.locationId() || undefined,
      categoryId: this.categoryId() || undefined,
      showZero: this.showZero(),
    };
  }

  private buildListParams(): StockBalancesParams {
    const take = this.pageSize();
    return {
      ...this.buildFilterParams(),
      take,
      skip: (this.pageIndex() - 1) * take,
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

  private loadRequirements(): void {
    this.itemsApi
      .checkRequirements()
      .pipe(first())
      .subscribe({
        next: (res) => {
          if (!res.success || !res.data) {
            this.obStatus.set(StockBalancesComponent.DEFAULT_OB_STATUS);
            return;
          }
          const normalizedObStatus =
            res.data.obStatus ??
            (res.data.isOpeningBalanceAllowed ? 'OPEN' : StockBalancesComponent.DEFAULT_OB_STATUS);
          this.obStatus.set(normalizedObStatus);
        },
        error: () => this.obStatus.set(StockBalancesComponent.DEFAULT_OB_STATUS),
      });
  }
}
