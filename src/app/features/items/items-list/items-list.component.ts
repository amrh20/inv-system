import { DecimalPipe, NgClass } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import {
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  OnInit,
  signal,
  TemplateRef,
  ViewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, first } from 'rxjs/operators';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
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
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Download,
  EllipsisVertical,
  Eye,
  FileSpreadsheet,
  Loader2,
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
import { StatusToggleComponent } from '../../../shared/components/status-toggle/status-toggle.component';
import { ItemFormComponent } from '../item-form/item-form.component';
import type {
  CategoryOption,
  ItemCreationBlockReason,
  ItemCreationRequirementKey,
  ItemImportPreviewData,
  ItemImportPreviewRow,
  ItemImportResult,
  ItemListRow,
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
    NzCheckboxModule,
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
    ItemFormComponent,
    StatusToggleComponent,
  ],
  templateUrl: './items-list.component.html',
  styleUrl: './items-list.component.scss',
})
export class ItemsListComponent implements OnInit {
  @ViewChild('importFooterTpl', { static: true }) importFooterRef!: TemplateRef<Record<string, unknown>>;
  @ViewChild('importFileInput') importFileInputRef?: ElementRef<HTMLInputElement>;

  private readonly itemsApi = inject(ItemsService);
  private readonly categoriesApi = inject(CategoriesService);
  private readonly lookups = inject(ItemMasterLookupsService);
  private readonly message = inject(NzMessageService);
  private readonly confirmation = inject(ConfirmationService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly translate = inject(TranslateService);

  readonly lucidePackage = Package;
  readonly lucidePlus = Plus;
  readonly lucideSearch = Search;
  readonly lucideRefresh = RefreshCw;
  readonly lucideDownload = Download;
  readonly lucideUpload = Upload;
  readonly lucideFileSpreadsheet = FileSpreadsheet;
  readonly lucidePencil = Pencil;
  readonly lucideTrash = Trash2;
  readonly lucideEye = Eye;
  readonly lucideLoader = Loader2;
  readonly lucideCheckCircle = CheckCircle2;
  readonly lucideArrowLeft = ArrowLeft;
  readonly lucideArrowRight = ArrowRight;
  readonly lucideAlertCircle = AlertCircle;
  readonly lucideX = X;
  readonly lucideEllipsisVertical = EllipsisVertical;
  readonly importStepKeys = [
    'ITEMS.STEP_UPLOAD_FILE',
    'ITEMS.STEP_PREVIEW_VALIDATE',
    'ITEMS.STEP_CONFIRM_IMPORT',
  ] as const;

  /** From `GET /items/check-requirements`; disables create/import when false. */
  readonly requirementsMet = signal(true);
  /** When `canCreateItem` is false, distinguishes missing master data vs closed Opening Balance period. */
  readonly blockReason = signal<ItemCreationBlockReason | null>(null);
  readonly missingData = signal<ItemCreationRequirementKey[]>([]);
  readonly requirementsLoading = signal(true);

  /** Settings page route (Opening Balance controls). */
  readonly openingBalanceSettingsPath = '/settings';

  readonly showPrerequisitesBanner = computed(
    () =>
      !this.requirementsMet() &&
      !this.requirementsLoading() &&
      this.blockReason() !== 'OPENING_BALANCE',
  );

  readonly showOpeningBalanceBanner = computed(
    () =>
      !this.requirementsMet() &&
      !this.requirementsLoading() &&
      this.blockReason() === 'OPENING_BALANCE',
  );

  /** Disables New item + Import when prerequisites or OB block creation. */
  readonly itemCreationActionsDisabled = computed(
    () => this.requirementsLoading() || !this.requirementsMet(),
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

  readonly formOpen = signal(false);
  readonly formItem = signal<ItemListRow | null>(null);

  readonly viewOpen = signal(false);
  readonly viewItem = signal<ItemListRow | null>(null);

  readonly importOpen = signal(false);
  readonly importStep = signal(0);
  readonly importFile = signal<File | null>(null);
  readonly importPreviewData = signal<ItemImportPreviewData | null>(null);
  readonly importResult = signal<ItemImportResult | null>(null);
  readonly importLoading = signal(false);
  readonly obLoading = signal(false);
  readonly importError = signal('');
  readonly obEligible = signal<{ allowed: boolean; reason?: string } | null>(null);
  readonly asOpeningBalance = signal(false);

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

  readonly sortQtyFn: NzTableSortFn<ItemListRow> = (a, b) => this.totalQty(a) - this.totalQty(b);

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

  /** Router paths under `/master-data/*` (redirect to real list pages). */
  requirementMasterDataPath(key: ItemCreationRequirementKey): string {
    switch (key) {
      case 'units':
        return '/master-data/units';
      case 'categories':
        return '/master-data/categories';
      case 'vendors':
        return '/master-data/suppliers';
      case 'locations':
        return '/master-data/locations';
      default:
        return '/';
    }
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
            return;
          }
          const { canCreateItem, requirements: r, blockReason: br } = res.data;
          this.requirementsMet.set(canCreateItem);
          this.blockReason.set(br ?? null);
          const missing: ItemCreationRequirementKey[] = [];
          if (r.units.count === 0) {
            missing.push('units');
          }
          if (r.categories.count === 0) {
            missing.push('categories');
          }
          if (r.vendors.count === 0) {
            missing.push('vendors');
          }
          if (r.locations.count === 0) {
            missing.push('locations');
          }
          this.missingData.set(missing);
          if (!canCreateItem && !br && missing.length === 0) {
            this.blockReason.set('OPENING_BALANCE');
          }
        },
        error: () => {
          this.requirementsLoading.set(false);
          this.requirementsMet.set(true);
          this.blockReason.set(null);
          this.missingData.set([]);
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
    this.formItem.set(null);
    this.formOpen.set(true);
  }

  openEdit(row: ItemListRow): void {
    this.formItem.set(row);
    this.formOpen.set(true);
  }

  closeForm(): void {
    this.formOpen.set(false);
    this.formItem.set(null);
  }

  onFormSaved(): void {
    this.closeForm();
    this.message.success(this.t('ITEMS.SUCCESS_SAVED'));
    this.loadItems();
  }

  openView(row: ItemListRow): void {
    this.viewItem.set(row);
    this.viewOpen.set(true);
  }

  closeView(): void {
    this.viewOpen.set(false);
    this.viewItem.set(null);
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

  formatPrice(row: ItemListRow): string {
    return (Number(row.unitPrice) || 0).toFixed(2);
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

  openImport(): void {
    this.importOpen.set(true);
    this.resetImportState();
    this.obLoading.set(true);
    this.lookups.obEligible().pipe(first()).subscribe({
      next: (o) => {
        this.obEligible.set(o);
        this.asOpeningBalance.set(!!o.allowed);
        this.obLoading.set(false);
      },
      error: () => {
        this.obEligible.set({ allowed: false, reason: this.t('ITEMS.ERROR_OB_ELIGIBILITY') });
        this.asOpeningBalance.set(false);
        this.obLoading.set(false);
      },
    });
  }

  closeImport(): void {
    this.importOpen.set(false);
    this.resetImportState();
  }

  onImportFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    const f = input.files?.[0];
    this.importFile.set(f ?? null);
    this.importError.set('');
    input.value = '';
  }

  triggerImportFileSelection(): void {
    this.importFileInputRef?.nativeElement.click();
  }

  runImportPreview(): void {
    const file = this.importFile();
    if (!file) {
      this.importError.set(this.t('ITEMS.ERROR_SELECT_FILE_FIRST'));
      return;
    }
    this.importLoading.set(true);
    this.importError.set('');
    this.itemsApi
      .importPreview(file)
      .pipe(first())
      .subscribe({
        next: (data) => {
          this.importPreviewData.set({
            ...data,
            preview: Array.isArray(data.preview) ? data.preview : [],
            filePath: typeof data.filePath === 'string' ? data.filePath : '',
            total: Number(data.total) || 0,
            valid: Number(data.valid) || 0,
            invalid: Number(data.invalid) || 0,
            storeColumns: Array.isArray(data.storeColumns) ? data.storeColumns : [],
            unknownColumns: Array.isArray(data.unknownColumns) ? data.unknownColumns : [],
          });
          this.importStep.set(1);
          this.importLoading.set(false);
        },
        error: (err: { error?: { message?: string } }) => {
          this.importLoading.set(false);
          this.importError.set(err?.error?.message ?? this.t('ITEMS.ERROR_PARSE_FILE'));
        },
      });
  }

  confirmImport(): void {
    const prev = this.importPreviewData();
    if (!prev?.filePath || (Number(prev.valid) || 0) <= 0) {
      this.importError.set(this.t('ITEMS.ERROR_NO_VALID_ROWS'));
      return;
    }
    this.importLoading.set(true);
    this.importError.set('');
    this.itemsApi
      .importItems(prev.preview, prev.filePath, this.asOpeningBalance())
      .pipe(first())
      .subscribe({
        next: (result) => {
          this.importLoading.set(false);
          this.importResult.set(result);
          this.importStep.set(2);
          this.message.success(this.t('ITEMS.SUCCESS_IMPORT_COMPLETED'));
          this.loadItems();
        },
        error: (err: { error?: { message?: string } }) => {
          this.importLoading.set(false);
          const error = err as HttpErrorResponse;
          if (error.status === 403) {
            const forbiddenMessage =
              (error.error as { message?: string } | null)?.message ??
              this.t('ITEMS.ERROR_OB_IMPORT_FORBIDDEN');
            this.importError.set(forbiddenMessage);
            this.message.error(forbiddenMessage);
            return;
          }
          this.importError.set(err?.error?.message ?? this.t('COMMON.IMPORT_FAILED'));
        },
      });
  }

  goBackImportStep(): void {
    if (this.importStep() > 0 && this.importStep() < 2) {
      this.importStep.set(this.importStep() - 1);
      this.importError.set('');
    }
  }

  importRowStoreCount(row: ItemImportPreviewRow): number {
    return row.data?.storeQuantities ? Object.keys(row.data.storeQuantities).length : 0;
  }

  importFileSizeLabel(file: File | null): string {
    if (!file) {
      return '';
    }
    const sizeKb = file.size / 1024;
    if (sizeKb < 1024) {
      return `${sizeKb.toFixed(1)} KB`;
    }
    return `${(sizeKb / 1024).toFixed(1)} MB`;
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

  private resetImportState(): void {
    this.importStep.set(0);
    this.importFile.set(null);
    this.importPreviewData.set(null);
    this.importResult.set(null);
    this.importLoading.set(false);
    this.obLoading.set(false);
    this.importError.set('');
  }
}
