import { DecimalPipe, NgClass } from '@angular/common';
import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, first } from 'rxjs/operators';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDescriptionsModule } from 'ng-zorro-antd/descriptions';
import { NzDividerModule } from 'ng-zorro-antd/divider';
import { NzGridModule } from 'ng-zorro-antd/grid';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzDropdownModule } from 'ng-zorro-antd/dropdown';
import { NzMenuModule } from 'ng-zorro-antd/menu';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzTooltipModule } from 'ng-zorro-antd/tooltip';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import type { NzTableSortFn } from 'ng-zorro-antd/table';
import { LucideAngularModule } from 'lucide-angular';
import {
  Download,
  EllipsisVertical,
  Eye,
  Info,
  Package,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Upload,
  X,
} from 'lucide-angular';
import { ConfirmationService } from '../../../core/services/confirmation.service';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { StatusToggleComponent } from '../../../shared/components/status-toggle/status-toggle.component';
import {
  getMissingItemCreationRequirements,
  ITEM_CREATION_REQUIREMENT_ROUTES,
  type CategoryOption,
  type ItemCreationBlockReason,
  type ItemCreationRequirementKey,
  type ItemDetail,
  type ItemListRow,
  type RequirementsResponse,
} from '../models/item.model';
import { CategoriesService } from '../services/categories.service';
import { ItemMasterLookupsService } from '../services/item-master-lookups.service';
import { ItemsService } from '../services/items.service';

@Component({
  selector: 'app-items-list',
  standalone: true,
  providers: [ConfirmationService],
  imports: [
    FormsModule,
    DecimalPipe,
    NgClass,
    NzAlertModule,
    NzButtonModule,
    NzDescriptionsModule,
    NzDividerModule,
    NzDropdownModule,
    NzGridModule,
    NzInputModule,
    NzMenuModule,
    NzModalModule,
    NzSelectModule,
    NzSpinModule,
    NzTableModule,
    NzTagModule,
    NzTooltipModule,
    TranslatePipe,
    RouterLink,
    LucideAngularModule,
    EmptyStateComponent,
    StatusToggleComponent,
  ],
  templateUrl: './items-list.component.html',
  styleUrl: './items-list.component.scss',
})
export class ItemsListComponent implements OnInit {
  private static readonly DEFAULT_OB_STATUS: NonNullable<RequirementsResponse['obStatus']> = 'FINALIZED';

  private readonly itemsApi = inject(ItemsService);
  private readonly categoriesApi = inject(CategoriesService);
  private readonly lookups = inject(ItemMasterLookupsService);
  private readonly message = inject(NzMessageService);
  private readonly confirmation = inject(ConfirmationService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly translate = inject(TranslateService);
  private readonly router = inject(Router);

  readonly lucidePackage = Package;
  readonly lucidePlus = Plus;
  readonly lucideSearch = Search;
  readonly lucideRefresh = RefreshCw;
  readonly lucideDownload = Download;
  readonly lucideUpload = Upload;
  readonly lucidePencil = Pencil;
  readonly lucideTrash = Trash2;
  readonly lucideEye = Eye;
  readonly lucideX = X;
  readonly lucideEllipsisVertical = EllipsisVertical;
  readonly lucideInfo = Info;

  /** From `GET /items/check-requirements`; disables create/import when false. */
  readonly requirementsMet = signal(true);
  /** When `canCreateItem` is false, missing master data (`MISSING_PREREQUISITES`). */
  readonly blockReason = signal<ItemCreationBlockReason | null>(null);
  /** `true` while Initial Setup / OB stage is OPEN (`isOpeningBalanceAllowed` from check-requirements). False after finalize or when locked. */
  readonly openingBalanceSetupActive = signal(false);
  readonly obStatus = signal<NonNullable<RequirementsResponse['obStatus']>>(
    ItemsListComponent.DEFAULT_OB_STATUS,
  );
  readonly missingData = signal<ItemCreationRequirementKey[]>([]);
  readonly requirementsLoading = signal(true);

  /** Settings page route (Opening Balance controls). */
  readonly openingBalanceSettingsPath = '/settings';

  /** Explicit OB OPEN phase — drives draft setup columns and Total qty hint. */
  readonly showObDraftColumns = computed(() => this.obStatus() === 'OPEN');

  /** Minimum table width for horizontal scroll — prevents fixed-layout columns from collapsing into single-character wraps. */
  readonly itemsTableScrollX = computed(() => (this.showObDraftColumns() ? '1520px' : '1360px'));
  readonly deleteLockedAfterObFinalization = computed(() => this.obStatus() === 'FINALIZED');

  readonly showPrerequisitesBanner = computed(
    () =>
      !this.requirementsLoading() &&
      this.blockReason() === 'MISSING_PREREQUISITES' &&
      this.missingData().length > 0,
  );

  /** Warn when tenant is in INITIAL_LOCK and needs OB setup activation first. */
  readonly showInitialSetupRequiredBanner = computed(
    () => !this.requirementsLoading() && this.obStatus() === 'INITIAL_LOCK',
  );

  /** Disable Add / Import only while loading, missing prerequisites, or OB is INITIAL_LOCK. */
  readonly itemCreationActionsDisabled = computed(
    () => {
      if (this.requirementsLoading()) {
        return true;
      }

      if (this.obStatus() === 'INITIAL_LOCK') {
        return true;
      }

      if (this.requirementsMet()) {
        return false;
      }

      // Keep blocking if the backend explicitly says prerequisites are missing.
      if (this.blockReason() === 'MISSING_PREREQUISITES') {
        return true;
      }

      // For OPEN and FINALIZED, creation actions remain enabled.
      if (this.obStatus() === 'OPEN' || this.obStatus() === 'FINALIZED') {
        return false;
      }

      return true;
    },
  );

  /** Current page rows — mirrors React `ItemMasterPage` `items` state. */
  readonly itemsList = signal<ItemListRow[]>([]);
  readonly total = signal(0);
  readonly loading = signal(false);
  readonly listError = signal('');

  readonly pageIndex = signal(1);
  readonly pageSize = signal(20);

  readonly searchDraft = signal('');
  private readonly searchTerm = signal('');
  private readonly search$ = new Subject<string>();

  readonly categoryId = signal('');
  readonly departmentId = signal('');
  readonly locationId = signal('');
  /** '', 'true', 'false' for all/active/inactive */
  readonly activeFilter = signal('true');

  readonly categories = signal<CategoryOption[]>([]);
  readonly departments = signal<{ id: string; name: string }[]>([]);
  readonly locations = signal<{ id: string; name: string; departmentId: string | null }[]>([]);

  readonly viewOpen = signal(false);
  /** List row: fallback while detail loads or if `GET /items/:id` fails. */
  readonly viewItem = signal<ItemListRow | null>(null);
  readonly viewItemDetail = signal<ItemDetail | null>(null);
  readonly viewDetailLoading = signal(false);
  private viewDetailRequestGen = 0;

  /** Prefer `GET /items/:id` payload (includes subcategory when API provides it). */
  readonly viewDisplay = computed<ItemListRow | null>(
    () => this.viewItemDetail() ?? this.viewItem(),
  );

  readonly filteredLocations = computed(() => {
    const dept = this.departmentId();
    const locs = this.locations();
    if (!dept) {
      return locs;
    }
    return locs.filter((l) => !l.departmentId || l.departmentId === dept);
  });

  readonly sortNameFn: NzTableSortFn<ItemListRow> = (a, b) =>
    (a.name ?? '').localeCompare(b.name ?? '', undefined, { sensitivity: 'base' });

  readonly sortBarcodeFn: NzTableSortFn<ItemListRow> = (a, b) =>
    (a.barcode ?? '').localeCompare(b.barcode ?? '', undefined, { sensitivity: 'base' });

  readonly sortCategoryFn: NzTableSortFn<ItemListRow> = (a, b) =>
    (a.category?.name ?? '').localeCompare(b.category?.name ?? '', undefined, {
      sensitivity: 'base',
    });

  readonly sortPriceFn: NzTableSortFn<ItemListRow> = (a, b) =>
    (Number(a.unitPrice) || 0) - (Number(b.unitPrice) || 0);

  readonly sortQtyFn: NzTableSortFn<ItemListRow> = (a, b) =>
    this.displayTotalQty(a) - this.displayTotalQty(b);

  readonly sortOpeningQtyFn: NzTableSortFn<ItemListRow> = (a, b) =>
    (this.draftOpeningQtySortValue(a) ?? -1) - (this.draftOpeningQtySortValue(b) ?? -1);

  ngOnInit(): void {
    this.search$
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe((q) => {
        this.searchTerm.set(q);
        this.pageIndex.set(1);
        this.loadItems();
      });

    this.loadRequirements();
    this.loadFilterOptions();
    this.loadItems();
  }

  /** Comma-separated translated labels for the warning message. */
  missingLabelsJoined(): string {
    return this.missingData()
      .map((k) => this.t(`ITEMS.REQUIREMENT_LABEL.${k.toUpperCase()}`))
      .join(', ');
  }

  /** Master-data list routes for prerequisite quick links. */
  requirementMasterDataPath(key: ItemCreationRequirementKey): string {
    return ITEM_CREATION_REQUIREMENT_ROUTES[key];
  }

  private loadRequirements(): void {
    this.requirementsLoading.set(true);
    this.itemsApi
      .checkRequirements()
      .pipe(first(), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.requirementsLoading.set(false);
          if (!res.success || !res.data) {
            this.requirementsMet.set(true);
            this.blockReason.set(null);
            this.missingData.set([]);
            this.openingBalanceSetupActive.set(false);
            this.obStatus.set(ItemsListComponent.DEFAULT_OB_STATUS);
            return;
          }
          const { canCreateItem, requirements: r, blockReason: br, isOpeningBalanceAllowed, obStatus } =
            res.data;
          const normalizedObStatus = ItemsListComponent.normalizeObStatusFromCheckRequirements(
            obStatus,
            isOpeningBalanceAllowed,
          );
          this.requirementsMet.set(canCreateItem);
          this.blockReason.set(br ?? null);
          this.obStatus.set(normalizedObStatus);
          this.openingBalanceSetupActive.set(normalizedObStatus === 'OPEN');
          this.missingData.set(getMissingItemCreationRequirements(r));
        },
        error: () => {
          this.requirementsLoading.set(false);
          this.requirementsMet.set(true);
          this.blockReason.set(null);
          this.missingData.set([]);
          this.openingBalanceSetupActive.set(false);
          this.obStatus.set(ItemsListComponent.DEFAULT_OB_STATUS);
        },
      });
  }

  onSearchInput(value: string): void {
    this.searchDraft.set(value);
    this.search$.next(value.trim());
  }

  onFilterChange(): void {
    this.pageIndex.set(1);
    this.loadItems();
  }

  onDepartmentChange(): void {
    this.locationId.set('');
    this.onFilterChange();
  }

  clearFilters(): void {
    this.searchDraft.set('');
    this.searchTerm.set('');
    this.categoryId.set('');
    this.departmentId.set('');
    this.locationId.set('');
    this.pageIndex.set(1);
    this.loadItems();
  }

  onPageIndexChange(page: number): void {
    this.pageIndex.set(page);
    this.loadItems();
  }

  onPageSizeChange(size: number): void {
    this.pageSize.set(size);
    this.pageIndex.set(1);
    this.loadItems();
  }

  loadItems(): void {
    this.loading.set(true);
    this.listError.set('');
    const skip = (this.pageIndex() - 1) * this.pageSize();
    const active = this.activeFilter();
    this.itemsApi
      .list({
        skip,
        take: this.pageSize(),
        search: this.searchTerm() || undefined,
        categoryId: this.categoryId() || undefined,
        departmentId: this.departmentId() || undefined,
        locationId: this.locationId() || undefined,
        isActive: active === 'all' ? undefined : active,
      })
      .pipe(first())
      .subscribe({
        next: (res) => {
          this.itemsList.set(res.items);
          this.total.set(res.total);
          this.loading.set(false);
        },
        error: (err: { error?: { message?: string } }) => {
          this.loading.set(false);
          this.listError.set(err?.error?.message ?? this.t('ITEMS.ERROR_LOAD'));
        },
      });
  }

  openCreate(): void {
    void this.router.navigate(['/items/new']);
  }

  openView(row: ItemListRow): void {
    const gen = ++this.viewDetailRequestGen;
    this.viewItem.set(row);
    this.viewItemDetail.set(null);
    this.viewOpen.set(true);
    this.viewDetailLoading.set(true);
    this.itemsApi
      .getItemById(row.id)
      .pipe(first(), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (detail) => {
          if (gen !== this.viewDetailRequestGen) {
            return;
          }
          this.viewItemDetail.set(detail);
          this.viewDetailLoading.set(false);
        },
        error: () => {
          if (gen !== this.viewDetailRequestGen) {
            return;
          }
          this.viewDetailLoading.set(false);
          this.message.error(this.t('ITEMS.ERROR_LOAD'));
        },
      });
  }

  closeView(): void {
    this.viewDetailRequestGen += 1;
    this.viewOpen.set(false);
    this.viewItem.set(null);
    this.viewItemDetail.set(null);
    this.viewDetailLoading.set(false);
  }

  deleteItem(row: ItemListRow): void {
    this.itemsApi
      .deleteItem(row.id)
      .pipe(first())
      .subscribe({
        next: () => {
          this.message.success(this.t('ITEMS.SUCCESS_DELETED'));
          this.loadItems();
        },
        error: (err: { error?: { message?: string } }) => {
          this.message.error(err?.error?.message ?? this.t('ITEMS.ERROR_DELETE'));
        },
      });
  }

  onDeleteClick(row: ItemListRow): void {
    if (this.deleteLockedAfterObFinalization()) {
      this.message.warning(this.t('ITEMS.DELETE_LOCKED_AFTER_OB_FINALIZED_TOOLTIP'));
      return;
    }
    this.confirmation
      .confirm({
        title: this.t('ITEMS.CONFIRM_DELETE_TITLE'),
        message: this.t('ITEMS.CONFIRM_DELETE_MESSAGE', { name: row.name }),
        confirmText: this.t('COMMON.DELETE'),
        cancelText: this.t('COMMON.CANCEL'),
        confirmDanger: true,
      })
      .pipe(first())
      .subscribe((confirmed) => {
        if (confirmed) {
          this.deleteItem(row);
        }
      });
  }

  /** Same as React `handleToggleActive` — `PATCH /items/:id/toggle-active`. */
  toggleItemActive(row: ItemListRow): void {
    this.itemsApi
      .toggleActive(row.id)
      .pipe(first())
      .subscribe({
        next: () => {
          this.message.success(
            row.isActive ? this.t('ITEMS.SUCCESS_DEACTIVATED') : this.t('ITEMS.SUCCESS_ACTIVATED'),
          );
          this.loadItems();
        },
        error: (err: { error?: { message?: string } }) => {
          this.message.error(err?.error?.message ?? this.t('ITEMS.ERROR_TOGGLE_STATUS'));
        },
      });
  }

  onToggleStatusClick(row: ItemListRow): void {
    this.confirmation
      .confirm({
        title: row.isActive
          ? this.t('ITEMS.CONFIRM_DEACTIVATE_TITLE')
          : this.t('ITEMS.CONFIRM_ACTIVATE_TITLE'),
        message: this.t('ITEMS.CONFIRM_TOGGLE_MESSAGE', {
          action: this.t(row.isActive ? 'COMMON.DEACTIVATE' : 'COMMON.ACTIVATE'),
          name: row.name,
        }),
        confirmText: this.t(row.isActive ? 'COMMON.DEACTIVATE' : 'COMMON.ACTIVATE'),
        cancelText: this.t('COMMON.CANCEL'),
      })
      .pipe(first())
      .subscribe((confirmed) => {
        if (confirmed) {
          this.toggleItemActive(row);
        }
      });
  }

  imageSrc(row: ItemListRow): string | null {
    return this.itemsApi.resolveAssetUrl(row.imageUrl);
  }

  baseUnitLabel(row: ItemListRow): string {
    const base = row.itemUnits?.find((u) => u.unitType === 'BASE');
    if (!base?.unit) {
      return '—';
    }
    const abbr = base.unit.abbreviation ? ` (${base.unit.abbreviation})` : '';
    return `${base.unit.name}${abbr}`;
  }

  totalQty(row: ItemListRow): number {
    return (row.stockBalances ?? []).reduce(
      (sum, b) => sum + (Number(b.qtyOnHand) || 0),
      0,
    );
  }

  /**
   * During OB OPEN: backend `displayTotalQty` (sum of DRAFT opening lines).
   * Otherwise: on-hand total from `stockBalances`.
   */
  displayTotalQty(row: ItemListRow): number {
    const raw = row.displayTotalQty;
    if (raw != null && String(raw).trim() !== '') {
      const n = Number(raw);
      if (Number.isFinite(n)) {
        return n;
      }
    }
    return this.totalQty(row);
  }

  formatPrice(row: ItemListRow): string {
    return (Number(row.unitPrice) || 0).toFixed(2);
  }

  draftOpeningQty(row: ItemListRow): number | null {
    const fromApi = row.openingQuantity ?? row.openingBalanceDraftQty;
    if (fromApi != null && String(fromApi).trim() !== '') {
      const n = Number(fromApi);
      return Number.isFinite(n) ? n : null;
    }
    return null;
  }

  /**
   * During OB OPEN: draft opening line value uses catalog unit price × opening quantity.
   */
  obDraftStockValueLine(row: ItemListRow): string {
    const q = this.draftOpeningQty(row);
    if (q == null || q <= 0) {
      return '—';
    }
    const p = Number(row.unitPrice) || 0;
    const total = q * p;
    return `${this.t('COMMON.CURRENCY_SAR')} ${total.toFixed(2)}`;
  }

  private draftOpeningQtySortValue(row: ItemListRow): number | null {
    return this.draftOpeningQty(row);
  }

  private static normalizeObStatusFromCheckRequirements(
    obStatus: RequirementsResponse['obStatus'] | undefined,
    isOpeningBalanceAllowed: boolean,
  ): NonNullable<RequirementsResponse['obStatus']> {
    if (typeof obStatus === 'string') {
      const u = obStatus.trim().toUpperCase();
      if (u === 'OPEN' || u === 'INITIAL_LOCK' || u === 'FINALIZED') {
        return u;
      }
    }
    return isOpeningBalanceAllowed === true ? 'OPEN' : ItemsListComponent.DEFAULT_OB_STATUS;
  }

  downloadTemplate(): void {
    this.itemsApi
      .downloadTemplate()
      .pipe(first())
      .subscribe({
        next: (blob) => this.saveBlob(blob, 'Item_Import_Template.xlsx'),
        error: () => this.message.error(this.t('ITEMS.ERROR_DOWNLOAD_TEMPLATE')),
      });
  }

  exportItems(): void {
    const active = this.activeFilter();
    this.itemsApi
      .exportItems({
        search: this.searchTerm() || undefined,
        categoryId: this.categoryId() || undefined,
        departmentId: this.departmentId() || undefined,
        locationId: this.locationId() || undefined,
        isActive: active === 'all' ? undefined : active,
      })
      .pipe(first())
      .subscribe({
        next: (blob) => {
          const d = new Date().toISOString().split('T')[0];
          this.saveBlob(blob, `Items_Export_${d}.xlsx`);
        },
        error: () => this.message.error(this.t('COMMON.EXPORT_FAILED')),
      });
  }

  goToImportPage(): void {
    if (this.itemCreationActionsDisabled()) {
      return;
    }
    void this.router.navigate(['/inventory/items/import']);
  }

  private saveBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
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

  private t(key: string, params?: Record<string, unknown>): string {
    return this.translate.instant(key, params);
  }
}
