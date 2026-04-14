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
  ViewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { first } from 'rxjs/operators';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzStepsModule } from 'ng-zorro-antd/steps';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTooltipModule } from 'ng-zorro-antd/tooltip';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { LucideAngularModule } from 'lucide-angular';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  FileSpreadsheet,
  Loader2,
  Package,
  Upload,
} from 'lucide-angular';
import {
  getMissingItemCreationRequirements,
  ITEM_CREATION_REQUIREMENT_ROUTES,
  type ItemCreationBlockReason,
  type ItemCreationRequirementKey,
  type ItemImportIssue,
  type ItemImportPreviewData,
  type ItemImportPreviewRow,
  type ItemImportResult,
  type RequirementsResponse,
} from '../models/item.model';
import { ItemMasterLookupsService } from '../services/item-master-lookups.service';
import { ItemsService } from '../services/items.service';

/** Fixed import preview columns (order: Name → … → Unit Price) before dynamic store quantity columns. */
const IMPORT_PREVIEW_FIXED_COLUMNS: readonly {
  field: string;
  labelKey: string;
  cell: 'text' | 'unitPrice';
}[] = [
  { field: 'name', labelKey: 'COMMON.ITEM_NAME', cell: 'text' },
  { field: 'deptName', labelKey: 'ITEMS.PREVIEW_DEPT', cell: 'text' },
  { field: 'categoryName', labelKey: 'COMMON.CATEGORY', cell: 'text' },
  { field: 'vendorName', labelKey: 'COMMON.VENDOR', cell: 'text' },
  { field: 'baseUnitName', labelKey: 'COMMON.BASE_UNIT', cell: 'text' },
  { field: 'unitPrice', labelKey: 'COMMON.UNIT_PRICE', cell: 'unitPrice' },
];

type ImportPreviewTableColumn =
  | { kind: 'fixed'; field: string; labelKey: string; cell: 'text' | 'unitPrice' }
  | { kind: 'store'; storeColumn: string };

@Component({
  selector: 'app-item-import',
  standalone: true,
  imports: [
    DecimalPipe,
    FormsModule,
    NgClass,
    NzAlertModule,
    NzButtonModule,
    NzInputModule,
    NzStepsModule,
    NzTableModule,
    NzTooltipModule,
    TranslatePipe,
    RouterLink,
    LucideAngularModule,
  ],
  templateUrl: './item-import.component.html',
  styleUrl: './item-import.component.scss',
})
export class ItemImportComponent implements OnInit {
  private static readonly DEFAULT_OB_STATUS: NonNullable<RequirementsResponse['obStatus']> = 'FINALIZED';

  @ViewChild('importFileInput') importFileInputRef?: ElementRef<HTMLInputElement>;

  private readonly itemsApi = inject(ItemsService);
  private readonly lookups = inject(ItemMasterLookupsService);
  private readonly message = inject(NzMessageService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly translate = inject(TranslateService);
  private readonly router = inject(Router);

  readonly lucideFileSpreadsheet = FileSpreadsheet;
  readonly lucideUpload = Upload;
  readonly lucideCheckCircle = CheckCircle2;
  readonly lucideLoader = Loader2;
  readonly lucideArrowLeft = ArrowLeft;
  readonly lucideArrowRight = ArrowRight;
  readonly lucideAlertCircle = AlertCircle;
  readonly lucidePackage = Package;

  readonly requirementsMet = signal(true);
  readonly blockReason = signal<ItemCreationBlockReason | null>(null);
  readonly missingData = signal<ItemCreationRequirementKey[]>([]);
  readonly requirementsLoading = signal(true);
  readonly openingBalanceSetupActive = signal(false);
  /** Normalized from `GET /items/check-requirements` (aligned with Item Master list). */
  readonly obStatus = signal<NonNullable<RequirementsResponse['obStatus']>>(
    ItemImportComponent.DEFAULT_OB_STATUS,
  );
  readonly openingBalanceSettingsPath = '/settings';

  readonly showPrerequisitesBanner = computed(
    () => !this.requirementsMet() && !this.requirementsLoading(),
  );

  /**
   * Initial Setup banner: hidden when OB lifecycle is `OPEN` (user is already in active opening-balance entry).
   * Still driven by `isOpeningBalanceAllowed` for other phases where the reminder is useful.
   */
  readonly showOpeningBalanceBanner = computed(
    () =>
      this.requirementsMet() &&
      !this.requirementsLoading() &&
      this.openingBalanceSetupActive() &&
      this.obStatus() !== 'OPEN',
  );

  /** Block file/preview only when prerequisites missing or loading (not gated by OB phase). */
  readonly importBlocked = computed(
    () => this.requirementsLoading() || !this.requirementsMet(),
  );

  readonly importStep = signal(0);
  readonly importFile = signal<File | null>(null);
  readonly importPreviewData = signal<ItemImportPreviewData | null>(null);
  readonly importResult = signal<ItemImportResult | null>(null);
  readonly importLoading = signal(false);
  readonly obLoading = signal(false);
  readonly importError = signal('');
  readonly obEligible = signal<{ allowed: boolean; reason?: string } | null>(null);
  readonly openingBalanceReason = signal('');
  readonly importAsOpeningBalance = computed(() => this.obEligible()?.allowed === true);
  readonly previewFilter = signal<'all' | 'error' | 'valid'>('all');
  readonly locations = signal<{ id: string; name: string; departmentId: string | null }[]>([]);

  readonly previewRows = computed(() => {
    const rows = this.importPreviewData()?.preview ?? [];
    const filter = this.previewFilter();
    if (filter === 'error') {
      return rows.filter((row) => row.status === 'ERROR');
    }
    if (filter === 'valid') {
      return rows.filter((row) => row.status === 'VALID');
    }
    return rows;
  });

  readonly importPreviewTableColumns = computed((): ImportPreviewTableColumn[] => {
    const storeCols = this.importPreviewData()?.storeColumns ?? [];
    const fixed: ImportPreviewTableColumn[] = IMPORT_PREVIEW_FIXED_COLUMNS.map((c) => ({
      kind: 'fixed',
      field: c.field,
      labelKey: c.labelKey,
      cell: c.cell,
    }));
    const store: ImportPreviewTableColumn[] = storeCols.map((storeColumn) => ({
      kind: 'store',
      storeColumn,
    }));
    return [...fixed, ...store];
  });

  readonly disableConfirmImport = computed(() => {
    const validRows = Number(this.importPreviewData()?.valid) || 0;
    const obReasonMissing =
      this.importAsOpeningBalance() && !this.openingBalanceReason().trim();
    return this.importLoading() || validRows === 0 || obReasonMissing;
  });

  /** Scroll area for preview table (large datasets). */
  readonly previewTableScroll = { x: 'max-content', y: 'calc(100vh - 380px)' };

  ngOnInit(): void {
    this.loadRequirements();
    this.lookups
      .listLocations({ take: 200 })
      .pipe(first(), takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: (l) => this.locations.set(l), error: () => this.locations.set([]) });

    this.obLoading.set(true);
    this.lookups.obEligible().pipe(first()).subscribe({
      next: (o) => {
        this.obEligible.set(o);
        this.obLoading.set(false);
      },
      error: () => {
        this.obEligible.set({ allowed: false, reason: this.t('ITEMS.ERROR_OB_ELIGIBILITY') });
        this.obLoading.set(false);
      },
    });
  }

  missingLabelsJoined(): string {
    return this.missingData()
      .map((k) => this.t(`ITEMS.REQUIREMENT_LABEL.${k.toUpperCase()}`))
      .join(', ');
  }

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
            this.obStatus.set(ItemImportComponent.DEFAULT_OB_STATUS);
            return;
          }
          const { canCreateItem, requirements: r, blockReason: br, isOpeningBalanceAllowed, obStatus } =
            res.data;
          const normalizedObStatus = ItemImportComponent.normalizeObStatusFromCheckRequirements(
            obStatus,
            isOpeningBalanceAllowed,
          );
          this.requirementsMet.set(canCreateItem);
          this.blockReason.set(br ?? null);
          this.openingBalanceSetupActive.set(isOpeningBalanceAllowed === true);
          this.obStatus.set(normalizedObStatus);
          this.missingData.set(getMissingItemCreationRequirements(r));
        },
        error: () => {
          this.requirementsLoading.set(false);
          this.requirementsMet.set(true);
          this.blockReason.set(null);
          this.missingData.set([]);
          this.openingBalanceSetupActive.set(false);
          this.obStatus.set(ItemImportComponent.DEFAULT_OB_STATUS);
        },
      });
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
    return isOpeningBalanceAllowed === true ? 'OPEN' : ItemImportComponent.DEFAULT_OB_STATUS;
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
      .importPreview(file, { asOpeningBalance: this.importAsOpeningBalance() })
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
    const obReason = this.openingBalanceReason().trim();
    if (this.importAsOpeningBalance() && !obReason) {
      this.importError.set(this.t('ITEMS.ERROR_OB_REASON_REQUIRED'));
      return;
    }
    this.importLoading.set(true);
    this.importError.set('');
    this.itemsApi
      .importItems(
        prev.preview,
        prev.filePath,
        this.importAsOpeningBalance(),
        this.importAsOpeningBalance() ? obReason : undefined,
      )
      .pipe(first())
      .subscribe({
        next: (result) => {
          this.importLoading.set(false);
          this.importResult.set(result);
          this.importStep.set(2);
          this.message.success(this.t('ITEMS.SUCCESS_IMPORT_COMPLETED'));
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

  importPreviewColumnTrack(col: ImportPreviewTableColumn): string {
    return col.kind === 'fixed' ? `f:${col.field}` : `s:${col.storeColumn}`;
  }

  previewImportFieldValue(row: ItemImportPreviewRow, field: string): unknown {
    const d = row.data as Record<string, unknown>;
    switch (field) {
      case 'categoryName':
        return this.coalesceImportDataValue(d, [
          'categoryName',
          'category',
          'category_name',
        ]);
      case 'vendorName':
        return this.coalesceImportDataValue(d, [
          'vendorName',
          'supplierName',
          'vendor',
          'supplier',
          'supplier_name',
        ]);
      case 'baseUnitName':
        return this.coalesceImportDataValue(d, [
          'baseUnitName',
          'baseUnit',
          'unitName',
          'base_unit_name',
          'unitAbbreviation',
        ]);
      default:
        return d[field];
    }
  }

  private coalesceImportDataValue(d: Record<string, unknown>, keys: string[]): unknown {
    for (const key of keys) {
      const v = d[key];
      if (v === null || v === undefined) {
        continue;
      }
      if (typeof v === 'string') {
        if (v.trim().length === 0) {
          continue;
        }
        return v;
      }
      if (typeof v === 'object' && v !== null && 'name' in (v as object)) {
        const n = (v as { name?: unknown }).name;
        if (n !== null && n !== undefined && String(n).trim() !== '') {
          return n;
        }
        continue;
      }
      return v;
    }
    return undefined;
  }

  private previewImportIssueFields(field: string): string[] {
    switch (field) {
      case 'categoryName':
        return ['categoryName', 'category', 'category_name'];
      case 'vendorName':
        return ['vendorName', 'supplierName', 'vendor', 'supplier', 'supplier_name'];
      case 'baseUnitName':
        return [
          'baseUnitName',
          'baseUnit',
          'unitName',
          'base_unit_name',
          'unitAbbreviation',
        ];
      default:
        return [field];
    }
  }

  previewImportHasError(row: ItemImportPreviewRow, field: string): boolean {
    return this.previewImportIssueFields(field).some((f) => this.getIssuesByField(row, f).length > 0);
  }

  previewImportFieldIssueMessage(row: ItemImportPreviewRow, field: string): string {
    const messages = this.previewImportIssueFields(field).flatMap((f) =>
      this.getIssuesByField(row, f)
        .map((issue) => issue.message)
        .filter(Boolean),
    );
    return [...new Set(messages)].join(', ');
  }

  isMissingValue(value: unknown): boolean {
    if (value === null || value === undefined) {
      return true;
    }
    if (typeof value === 'string') {
      return value.trim().length === 0;
    }
    return false;
  }

  setPreviewFilter(filter: 'all' | 'error' | 'valid'): void {
    this.previewFilter.set(filter);
  }

  previewStoreLocationIdForColumn(columnName: string): string | null {
    const trimmed = columnName?.trim();
    if (!trimmed) {
      return null;
    }
    const locs = this.locations();
    const byExact = locs.find((l) => l.name === trimmed);
    if (byExact) {
      return byExact.id;
    }
    const lower = trimmed.toLowerCase();
    return locs.find((l) => l.name.trim().toLowerCase() === lower)?.id ?? null;
  }

  previewStoreQty(row: ItemImportPreviewRow, storeColumnName: string): number | string | null {
    const map = row.data?.storeQuantities;
    if (!map) {
      return null;
    }
    const id = this.previewStoreLocationIdForColumn(storeColumnName);
    let qty: unknown = undefined;
    if (id) {
      qty = map[id];
    }
    if (qty === undefined && storeColumnName) {
      qty = map[storeColumnName];
    }
    if (qty === undefined || qty === null || qty === '') {
      return null;
    }
    return qty as number | string;
  }

  previewStoreHasError(row: ItemImportPreviewRow, storeColumnName: string): boolean {
    return this.getIssuesForStorePreviewColumn(row, storeColumnName).length > 0;
  }

  previewStoreFieldIssueMessage(row: ItemImportPreviewRow, storeColumnName: string): string {
    return this.getIssuesForStorePreviewColumn(row, storeColumnName)
      .map((issue) => issue.message)
      .filter(Boolean)
      .join(', ');
  }

  private getIssuesForStorePreviewColumn(
    row: ItemImportPreviewRow,
    storeColumnName: string,
  ): ItemImportIssue[] {
    const id = this.previewStoreLocationIdForColumn(storeColumnName);
    const issues = Array.isArray(row.issues) ? row.issues : [];
    return issues.filter((issue) => {
      if (!issue.message) {
        return false;
      }
      if (this.issueFieldMatches(issue.field, storeColumnName)) {
        return true;
      }
      if (id) {
        if (this.issueFieldMatches(issue.field, `storeQuantities.${id}`)) {
          return true;
        }
        if (this.issueFieldMatches(issue.field, id)) {
          return true;
        }
      }
      return false;
    });
  }

  previewNumber(value: unknown): number | null {
    if (value === null || value === undefined || value === '') {
      return null;
    }
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
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

  rowIssuesSummary(row: ItemImportPreviewRow): string {
    const fromIssues = (row.issues ?? [])
      .map((i) => i.message)
      .filter((m): m is string => !!m);
    if (fromIssues.length) {
      return fromIssues.join(', ');
    }
    return (row.errors ?? []).join(', ');
  }

  doneNavigateToItems(): void {
    this.router.navigate(['/items']);
  }

  private t(key: string, params?: Record<string, unknown>): string {
    return this.translate.instant(key, params);
  }

  private getIssuesByField(row: ItemImportPreviewRow, fieldName: string): ItemImportIssue[] {
    const issues = Array.isArray(row.issues) ? row.issues : [];
    return issues.filter(
      (issue) => this.issueFieldMatches(issue.field, fieldName) && !!issue.message,
    );
  }

  private issueFieldMatches(issueField: string | undefined, fieldName: string): boolean {
    if (!issueField) {
      return false;
    }
    const normalize = (v: string) =>
      v
        .toLowerCase()
        .replace(/\s+/g, '')
        .replace(/['"]/g, '')
        .replace(/\[|\]/g, '.')
        .replace(/\.{2,}/g, '.');

    const issue = normalize(issueField);
    const target = normalize(fieldName);
    if (issue === target) {
      return true;
    }
    return issue.endsWith(`.${target}`);
  }
}
