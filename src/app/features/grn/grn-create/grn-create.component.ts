import { DecimalPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import {
  Component,
  DestroyRef,
  inject,
  OnInit,
  signal,
  computed,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { merge, Observable, of, Subject } from 'rxjs';
import { debounceTime, finalize, map, switchMap, tap } from 'rxjs/operators';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import {
  LucideAngularModule,
  FileText,
  Search,
  Trash2,
  Upload,
  CheckCircle2,
  Loader2,
  Package,
  FileSpreadsheet,
  Download,
} from 'lucide-angular';
import { ConfirmationService } from '../../../core/services/confirmation.service';
import type { ItemListRow } from '../../items/models/item.model';
import type { RequirementsResponse } from '../../items/models/item.model';
import {
  InventoryService,
  type ItemByLocationSelectRow,
} from '../../inventory/services/inventory.service';
import { ItemsService } from '../../items/services/items.service';
import { LocationsService } from '../../master-data/services/locations.service';
import { SuppliersService } from '../../master-data/services/suppliers.service';
import type { LocationRow } from '../../master-data/models/location.model';
import type { SupplierRow } from '../../master-data/models/supplier.model';
import type { GrnImportPreviewData, GrnManualLineDraft } from '../models/grn.model';
import { GrnService } from '../services/grn.service';

type CreateMode = 'manual' | 'excel';

@Component({
  selector: 'app-grn-create',
  standalone: true,
  imports: [
    FormsModule,
    DecimalPipe,
    NzAlertModule,
    NzButtonModule,
    NzCardModule,
    NzDatePickerModule,
    NzInputModule,
    NzSelectModule,
    NzSpinModule,
    NzTableModule,
    NzTabsModule,
    NzTagModule,
    TranslatePipe,
    LucideAngularModule,
  ],
  providers: [ConfirmationService],
  templateUrl: './grn-create.component.html',
  styleUrl: './grn-create.component.scss',
})
export class GrnCreateComponent implements OnInit {
  private readonly itemsApi = inject(ItemsService);
  private readonly inventoryApi = inject(InventoryService);
  private readonly suppliersApi = inject(SuppliersService);
  private readonly locationsApi = inject(LocationsService);
  private readonly grnApi = inject(GrnService);
  private readonly translate = inject(TranslateService);
  private readonly message = inject(NzMessageService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly confirmation = inject(ConfirmationService);

  readonly lucideFileText = FileText;
  readonly lucideSearch = Search;
  readonly lucideTrash = Trash2;
  readonly lucideUpload = Upload;
  readonly lucideCheck = CheckCircle2;
  readonly lucideLoader = Loader2;
  readonly lucidePackage = Package;
  readonly lucideSheet = FileSpreadsheet;
  readonly lucideDownload = Download;

  readonly mode = signal<CreateMode>('manual');
  readonly supplierId = signal('');
  readonly locationId = signal('');
  readonly grnNumber = signal('');
  readonly receivingDate = signal(this.todayIso());
  readonly notes = signal('');

  readonly lines = signal<GrnManualLineDraft[]>([]);
  readonly invoiceFile = signal<File | null>(null);
  readonly excelFile = signal<File | null>(null);
  readonly preview = signal<GrnImportPreviewData | null>(null);

  readonly loading = signal(false);
  readonly parseLoading = signal(false);
  readonly error = signal('');

  readonly suppliers = signal<SupplierRow[]>([]);
  readonly locations = signal<LocationRow[]>([]);
  readonly requirements = signal<RequirementsResponse | null>(null);

  readonly itemQuery = signal('');
  readonly itemResults = signal<ItemByLocationSelectRow[]>([]);
  readonly itemSearchLoading = signal(false);
  readonly itemDropdownOpen = signal(false);

  readonly invalidLineIndexes = signal<number[]>([]);

  private readonly search$ = new Subject<string>();
  /** Fires when a non-empty warehouse is selected/changed — immediate fetch (no debounce). */
  private readonly locationPrefetch$ = new Subject<void>();
  private skipDeactivate = false;

  readonly receivingDatePicker = computed(() => {
    const s = this.receivingDate();
    if (!s) return null;
    const [y, m, d] = s.split('-').map(Number);
    if (!y || !m || !d) return null;
    return new Date(y, m - 1, d);
  });

  readonly openingBalanceBlocksGrn = computed(
    () => this.requirements()?.isOpeningBalanceAllowed === true,
  );

  readonly manualGrandTotal = computed(() =>
    this.lines().reduce(
      (sum, l) => sum + (Number(l.receivedQty) || 0) * (Number(l.unitPrice) || 0),
      0,
    ),
  );

  readonly excelGrandTotal = computed(() => {
    const rows = this.preview()?.rows ?? [];
    return rows
      .filter((r) => r.status === 'VALID')
      .reduce(
        (sum, r) => sum + (Number(r.receivedQty) || 0) * (Number(r.unitPrice) || 0),
        0,
      );
  });

  readonly itemSearchDisabled = computed(() => !this.locationId().trim());

  ngOnInit(): void {
    this.itemsApi
      .checkRequirements()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.requirements.set(res.success && res.data ? res.data : null);
        },
        error: () => this.requirements.set(null),
      });

    this.suppliersApi
      .list({ take: 10000 })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((r) => this.suppliers.set(r.suppliers));

    this.locationsApi
      .list({ take: 10000 })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((r) => this.locations.set(r.locations));

    merge(
      this.search$.pipe(debounceTime(300)),
      this.locationPrefetch$.pipe(map(() => this.itemQuery().trim())),
    )
      .pipe(
        switchMap((q) => {
          const loc = this.locationId().trim();
          if (!loc) {
            return of(null).pipe(
              tap(() => {
                this.itemResults.set([]);
                this.itemSearchLoading.set(false);
                this.itemDropdownOpen.set(false);
              }),
            );
          }
          this.itemSearchLoading.set(true);
          return this.inventoryApi.getItemsByLocationSelect(loc, { search: q }).pipe(
            tap((items) => {
              this.itemResults.set(items);
              if (q.trim().length > 0) {
                this.itemDropdownOpen.set(true);
              }
            }),
            finalize(() => this.itemSearchLoading.set(false)),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        error: () => {
          this.itemResults.set([]);
        },
      });
  }

  onModeChange(mode: CreateMode): void {
    this.mode.set(mode);
    this.error.set('');
    if (mode === 'manual') {
      this.preview.set(null);
      this.excelFile.set(null);
    } else {
      this.lines.set([]);
      this.clearLineValidationUi();
    }
  }

  onTabIndexChange(index: number): void {
    this.onModeChange(index === 0 ? 'manual' : 'excel');
  }

  onItemQueryChange(value: string): void {
    this.itemQuery.set(value);
    this.search$.next(value.trim());
  }

  onReceivingDateChange(d: Date | null): void {
    if (!d) return;
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    this.receivingDate.set(`${y}-${m}-${day}`);
  }

  onWarehouseChange(value: string | null | undefined): void {
    const next = (value ?? '').trim();
    const prev = this.locationId();
    this.locationId.set(next);
    if (prev === next) {
      return;
    }
    this.lines.set([]);
    this.clearLineValidationUi();
    this.itemQuery.set('');
    this.itemResults.set([]);
    this.itemDropdownOpen.set(false);
    if (next) {
      this.locationPrefetch$.next();
    }
  }

  addItem(item: ItemByLocationSelectRow): void {
    if (this.lines().some((l) => l.itemId === item.id)) return;

    const itemId = (item.id ?? '').trim();
    if (!this.isValidUuidString(itemId)) {
      this.message.error(this.translate.instant('GRN.CREATE.ERROR_ADD_INVALID_ITEM_ID'));
      return;
    }
    this.itemsApi
      .getItemById(itemId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (itemDetail) => {
          const baseUom = this.resolveBaseUomFromItem(itemDetail);
          if (!baseUom || !this.isValidUuidString(baseUom.uomId)) {
            this.message.error(this.translate.instant('GRN.CREATE.ERROR_ADD_NO_BASE_UOM'));
            return;
          }

          this.lines.update((prev) => [
            ...prev,
            {
              itemId,
              itemName: itemDetail.name,
              barcode: itemDetail.barcode ?? '',
              imageUrl: itemDetail.imageUrl ?? null,
              uomId: baseUom.uomId,
              uomName: baseUom.uomName,
              receivedQty: '',
              unitPrice: itemDetail.unitPrice ?? '',
            },
          ]);
          this.clearLineValidationUi();
          this.itemQuery.set('');
          this.itemResults.set([]);
          this.itemDropdownOpen.set(false);
          if (this.locationId().trim()) {
            this.locationPrefetch$.next();
          }
        },
        error: () => {
          this.message.error(this.translate.instant('GRN.CREATE.ERROR_ADD_NO_BASE_UOM'));
        },
      });
  }

  updateLine(idx: number, field: keyof GrnManualLineDraft, value: string): void {
    this.clearLineValidationUi();
    this.lines.update((rows) =>
      rows.map((row, i) => (i === idx ? { ...row, [field]: value } : row)),
    );
  }

  removeLine(idx: number): void {
    this.clearLineValidationUi();
    this.lines.update((rows) => rows.filter((_, i) => i !== idx));
  }

  onInvoiceSelected(files: FileList | null): void {
    this.invoiceFile.set(files?.[0] ?? null);
  }

  onExcelSelected(files: FileList | null): void {
    this.excelFile.set(files?.[0] ?? null);
    this.preview.set(null);
    this.error.set('');
  }

  lineTotal(line: GrnManualLineDraft): number {
    return (Number(line.receivedQty) || 0) * (Number(line.unitPrice) || 0);
  }

  previewRowLineTotal(row: { receivedQty: string | number; unitPrice?: string | number }): number {
    return (Number(row.receivedQty) || 0) * (Number(row.unitPrice) || 0);
  }

  cancel(): void {
    void this.router.navigate(['/grn']);
  }

  downloadTemplate(): void {
    this.grnApi.downloadTemplate().subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'GRN_Template.xlsx';
        a.click();
        URL.revokeObjectURL(url);
      },
      error: () => {
        this.error.set(this.translate.instant('GRN.CREATE.ERROR_TEMPLATE'));
      },
    });
  }

  handleExcelPreview(): void {
    this.error.set('');
    if (!this.validateHeader()) return;
    const file = this.excelFile();
    if (!file) {
      this.error.set(this.translate.instant('GRN.CREATE.ERROR_EXCEL'));
      return;
    }
    this.parseLoading.set(true);
    const fd = new FormData();
    fd.append('file', file);
    this.grnApi.importPreview(fd).subscribe({
      next: (data) => {
        this.preview.set(data);
        this.parseLoading.set(false);
      },
      error: (err: { error?: { message?: string } }) => {
        this.parseLoading.set(false);
        this.error.set(
          err?.error?.message ?? this.translate.instant('GRN.CREATE.ERROR_PREVIEW'),
        );
      },
    });
  }

  submit(): void {
    this.error.set('');
    if (this.openingBalanceBlocksGrn()) {
      const msg = this.translate.instant('TRANSACTIONS.DISABLED_UNTIL_OB_FINALIZED');
      this.error.set(msg);
      this.message.error(msg);
      return;
    }
    if (!this.validateHeader()) return;
    if (!this.invoiceFile()) {
      this.error.set(this.translate.instant('GRN.CREATE.ERROR_INVOICE'));
      this.message.error(this.translate.instant('GRN.CREATE.ERROR_INVOICE'));
      return;
    }

    if (this.mode() === 'manual') {
      if (this.lines().length === 0) {
        this.error.set(this.translate.instant('GRN.CREATE.ERROR_LINES'));
        return;
      }
      const idCheck = this.validateManualLinesForIds();
      if (!idCheck.ok) {
        this.flagManualLineIdsError(idCheck.badIndexes, idCheck.firstBadName);
        return;
      }
      this.clearLineValidationUi();
      const bad = this.lines().find((l) => !l.receivedQty || Number(l.receivedQty) <= 0);
      if (bad) {
        this.error.set(
          this.translate.instant('GRN.CREATE.ERROR_RECEIVED_QTY', { name: bad.itemName }),
        );
        return;
      }
    } else {
      const pv = this.preview();
      if (!pv || pv.valid < 1) {
        this.error.set(this.translate.instant('GRN.CREATE.ERROR_EXCEL'));
        return;
      }
      if (!this.validateExcelLinesForCreate()) {
        this.error.set(this.translate.instant('GRN.CREATE.ERROR_EXCEL_LINE_IDS'));
        this.message.error(this.translate.instant('GRN.CREATE.ERROR_EXCEL_LINE_IDS'));
        return;
      }
    }

    this.loading.set(true);
    const form = new FormData();
    form.append('invoice', this.invoiceFile()!);
    form.append('supplierId', this.supplierId());
    form.append('locationId', this.locationId());
    form.append('grnNumber', this.grnNumber().trim());
    form.append('receivingDate', this.receivingDate());
    form.append('notes', this.notes());

    if (this.mode() === 'manual') {
      const payload = this.lines()
        .filter((l) => this.isValidUuidString(l.itemId) && this.isValidUuidString(l.uomId))
        .map((l) => {
          const rq = Number(l.receivedQty);
          return {
            itemId: l.itemId.trim(),
            uomId: l.uomId.trim(),
            orderedQty: rq,
            receivedQty: rq,
            unitPrice: Number(l.unitPrice) || 0,
          };
        });
      form.append('lines', JSON.stringify(payload));
    } else {
      const pv = this.preview();
      const payload =
        pv?.rows
          .filter(
            (r) =>
              r.status === 'VALID' &&
              this.isValidUuidString(r.itemId) &&
              this.isValidUuidString(r.uomId),
          )
          .map((r) => {
            const rq = Number(r.receivedQty);
            return {
              itemId: r.itemId!.trim(),
              uomId: r.uomId!.trim(),
              orderedQty: rq,
              receivedQty: rq,
              unitPrice: Number(r.unitPrice) || 0,
            };
          }) ?? [];
      form.append('lines', JSON.stringify(payload));
    }

    this.grnApi.create(form).subscribe({
      next: (result) => {
        this.loading.set(false);
        this.skipDeactivate = true;
        if (result.autoPosted) {
          const msg =
            result.message?.trim() ||
            this.translate.instant('GRN.CREATE_SUCCESS_POSTED');
          this.message.success(msg);
          void this.router.navigate(['/grn', result.id]);
          return;
        }
        this.message.success(this.translate.instant('GRN.CREATE_SUCCESS_REVIEW'));
        void this.router.navigate(['/grn'], { queryParams: { tab: 'VALIDATED' } });
      },
      error: (err: HttpErrorResponse | { error?: { message?: string } }) => {
        this.loading.set(false);
        if (err instanceof HttpErrorResponse && err.status === 403) {
          this.error.set(this.translate.instant('COMMON.PERMISSION_DENIED'));
          return;
        }
        const body = err instanceof HttpErrorResponse ? err.error : err?.error;
        this.error.set(
          (typeof body === 'object' && body && 'message' in body && typeof body.message === 'string'
            ? body.message
            : null) ?? this.translate.instant('GRN.CREATE.ERROR_CREATE'),
        );
      },
    });
  }

  confirmDeactivate(): boolean | Observable<boolean> {
    if (this.skipDeactivate || !this.isDirty()) {
      return true;
    }
    return this.confirmation.confirm({
      title: this.translate.instant('GRN.CREATE.LEAVE_TITLE'),
      message: this.translate.instant('GRN.CREATE.LEAVE_MESSAGE'),
      confirmText: this.translate.instant('GRN.CREATE.LEAVE_CONFIRM'),
      cancelText: this.translate.instant('COMMON.CANCEL'),
    });
  }

  isDirty(): boolean {
    if (this.lines().length > 0) return true;
    if (this.invoiceFile() || this.excelFile() || this.preview()) return true;
    if (this.notes().trim() || this.grnNumber().trim()) return true;
    if (this.supplierId() || this.locationId()) return true;
    return false;
  }

  private validateHeader(): boolean {
    if (!this.supplierId()) {
      this.error.set(this.translate.instant('GRN.CREATE.ERROR_SUPPLIER'));
      return false;
    }
    if (!this.locationId()) {
      this.error.set(this.translate.instant('GRN.CREATE.ERROR_WAREHOUSE'));
      return false;
    }
    if (!this.grnNumber().trim()) {
      this.error.set(this.translate.instant('GRN.CREATE.ERROR_GRN_NO'));
      return false;
    }
    if (!this.receivingDate().trim()) {
      this.error.set(this.translate.instant('GRN.CREATE.ERROR_DATE'));
      return false;
    }
    return true;
  }

  private todayIso(): string {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  private isValidUuidString(value: string | undefined | null): boolean {
    if (value == null) {
      return false;
    }
    const hex = value.trim().replace(/-/g, '');
    return hex.length === 32 && /^[0-9a-fA-F]+$/.test(hex);
  }

  private resolveBaseUomFromItem(item: ItemListRow): { uomId: string; uomName: string } | null {
    const base = item.itemUnits?.find((u) => u.unitType === 'BASE');
    if (!base) {
      return null;
    }
    const row = base as {
      unitId?: string;
      unit?: { id?: string; name?: string; abbreviation?: string };
    };
    const uomId = (row.unitId ?? row.unit?.id ?? '').trim();
    if (!uomId) {
      return null;
    }
    const uomName =
      row.unit?.abbreviation?.trim() ||
      row.unit?.name?.trim() ||
      '';
    return { uomId, uomName };
  }

  private validateManualLinesForIds():
    | { ok: true }
    | { ok: false; badIndexes: number[]; firstBadName: string } {
    const rows = this.lines();
    const badIndexes: number[] = [];
    let firstBadName = '';
    rows.forEach((l, i) => {
      if (!this.isValidUuidString(l.itemId) || !this.isValidUuidString(l.uomId)) {
        badIndexes.push(i);
        if (!firstBadName) {
          firstBadName = l.itemName;
        }
      }
    });
    if (badIndexes.length === 0) {
      return { ok: true };
    }
    return { ok: false, badIndexes, firstBadName };
  }

  private validateExcelLinesForCreate(): boolean {
    const pv = this.preview();
    const validRows = pv?.rows.filter((r) => r.status === 'VALID') ?? [];
    return validRows.every(
      (r) => this.isValidUuidString(r.itemId) && this.isValidUuidString(r.uomId),
    );
  }

  private clearLineValidationUi(): void {
    this.invalidLineIndexes.set([]);
  }

  private flagManualLineIdsError(badIndexes: number[], firstBadName: string): void {
    this.invalidLineIndexes.set(badIndexes);
    const msg = this.translate.instant('GRN.CREATE.ERROR_LINE_IDS', { name: firstBadName });
    this.error.set(msg);
    this.message.error(msg);
  }
}
