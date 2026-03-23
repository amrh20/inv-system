import { DecimalPipe } from '@angular/common';
import {
  Component,
  DestroyRef,
  inject,
  input,
  OnInit,
  output,
  signal,
  computed,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { of, Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap, tap } from 'rxjs/operators';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzTableModule } from 'ng-zorro-antd/table';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import {
  LucideAngularModule,
  FileText,
  Plus,
  Search,
  Trash2,
  Upload,
  CheckCircle2,
  Loader2,
  Package,
  FileSpreadsheet,
  ArrowRight,
  ArrowLeft,
  Download,
} from 'lucide-angular';
import type { ItemListRow } from '../../items/models/item.model';
import { ItemsService } from '../../items/services/items.service';
import { LocationsService } from '../../master-data/services/locations.service';
import { SuppliersService } from '../../master-data/services/suppliers.service';
import type { LocationRow } from '../../master-data/models/location.model';
import type { SupplierRow } from '../../master-data/models/supplier.model';
import type {
  GrnImportPreviewData,
  GrnManualLineDraft,
} from '../models/grn.model';
import { GrnService } from '../services/grn.service';

type CreateMode = 'manual' | 'excel';

@Component({
  selector: 'app-grn-create-modal',
  standalone: true,
  imports: [
    FormsModule,
    DecimalPipe,
    NzAlertModule,
    NzButtonModule,
    NzDatePickerModule,
    NzInputModule,
    NzModalModule,
    NzSelectModule,
    NzSpinModule,
    NzTableModule,
    TranslatePipe,
    LucideAngularModule,
  ],
  templateUrl: './grn-create-modal.component.html',
  styleUrl: './grn-create-modal.component.scss',
})
export class GrnCreateModalComponent implements OnInit {
  private readonly itemsApi = inject(ItemsService);
  private readonly suppliersApi = inject(SuppliersService);
  private readonly locationsApi = inject(LocationsService);
  private readonly grnApi = inject(GrnService);
  private readonly translate = inject(TranslateService);
  private readonly message = inject(NzMessageService);
  private readonly destroyRef = inject(DestroyRef);

  readonly open = input.required<boolean>();
  readonly closed = output<void>();
  readonly created = output<void>();

  readonly lucideFileText = FileText;
  readonly lucidePlus = Plus;
  readonly lucideSearch = Search;
  readonly lucideTrash = Trash2;
  readonly lucideUpload = Upload;
  readonly lucideCheck = CheckCircle2;
  readonly lucideLoader = Loader2;
  readonly lucidePackage = Package;
  readonly lucideSheet = FileSpreadsheet;
  readonly lucideArrowRight = ArrowRight;
  readonly lucideArrowLeft = ArrowLeft;
  readonly lucideDownload = Download;

  readonly mode = signal<CreateMode>('manual');
  readonly step = signal(1);

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
  readonly error = signal('');

  readonly suppliers = signal<SupplierRow[]>([]);
  readonly locations = signal<LocationRow[]>([]);

  readonly itemQuery = signal('');
  readonly itemResults = signal<ItemListRow[]>([]);
  readonly itemSearchLoading = signal(false);
  readonly itemDropdownOpen = signal(false);

  /** Row indexes (manual step 1) flagged when itemId/uomId validation fails. */
  readonly invalidLineIndexes = signal<number[]>([]);

  private readonly search$ = new Subject<string>();

  readonly receivingDatePicker = computed(() => {
    const s = this.receivingDate();
    if (!s) return null;
    const [y, m, d] = s.split('-').map(Number);
    if (!y || !m || !d) return null;
    return new Date(y, m - 1, d);
  });

  readonly supplierLabel = computed(() => {
    const id = this.supplierId();
    return this.suppliers().find((s) => s.id === id)?.name ?? '—';
  });

  readonly locationLabel = computed(() => {
    const id = this.locationId();
    return this.locations().find((l) => l.id === id)?.name ?? '—';
  });

  readonly manualTotal = computed(() =>
    this.lines().reduce(
      (sum, l) => sum + (Number(l.receivedQty) || 0) * (Number(l.unitPrice) || 0),
      0,
    ),
  );

  readonly isDone = computed(() => {
    const m = this.mode();
    const s = this.step();
    return (m === 'manual' && s === 3) || (m === 'excel' && s === 4);
  });

  readonly stepsManual = ['GRN.CREATE.STEP_FILL', 'GRN.CREATE.STEP_CONFIRM', 'GRN.CREATE.STEP_DONE'];
  readonly stepsExcel = [
    'GRN.CREATE.STEP_UPLOAD_EXCEL',
    'GRN.CREATE.STEP_PREVIEW',
    'GRN.CREATE.STEP_INVOICE_CONFIRM',
    'GRN.CREATE.STEP_DONE',
  ];

  ngOnInit(): void {
    this.suppliersApi
      .list({ take: 200 })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((r) => this.suppliers.set(r.suppliers));

    this.locationsApi
      .list({ take: 200 })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((r) => this.locations.set(r.locations));

    this.search$
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        switchMap((q) => {
          if (!q || q.length < 2) {
            return of(null).pipe(
              tap(() => {
                this.itemResults.set([]);
                this.itemSearchLoading.set(false);
                this.itemDropdownOpen.set(false);
              }),
            );
          }
          this.itemSearchLoading.set(true);
          return this.itemsApi.list({ search: q, take: 10, isActive: 'true' }).pipe(
            tap(() => this.itemSearchLoading.set(false)),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (res) => {
          if (res === null) return;
          this.itemResults.set(res.items);
          this.itemDropdownOpen.set(true);
        },
        error: () => {
          this.itemSearchLoading.set(false);
          this.itemResults.set([]);
        },
      });
  }

  onItemQueryChange(value: string): void {
    this.itemQuery.set(value);
    this.search$.next(value.trim());
  }

  onOpenChange(open: boolean): void {
    if (!open) {
      this.reset();
      this.closed.emit();
    }
  }

  switchMode(m: CreateMode): void {
    this.mode.set(m);
    this.step.set(1);
    this.error.set('');
    this.preview.set(null);
    this.excelFile.set(null);
    this.lines.set([]);
    this.clearLineValidationUi();
    this.invoiceFile.set(null);
  }

  onReceivingDateChange(d: Date | null): void {
    if (!d) return;
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    this.receivingDate.set(`${y}-${m}-${day}`);
  }

  addItem(item: ItemListRow): void {
    if (this.lines().some((l) => l.itemId === item.id)) return;

    const itemId = (item.id ?? '').trim();
    if (!this.isValidUuidString(itemId)) {
      this.message.error(this.translate.instant('GRN.CREATE.ERROR_ADD_INVALID_ITEM_ID'));
      return;
    }

    const baseUom = this.resolveBaseUomFromItem(item);
    if (!baseUom || !this.isValidUuidString(baseUom.uomId)) {
      this.message.error(this.translate.instant('GRN.CREATE.ERROR_ADD_NO_BASE_UOM'));
      return;
    }

    this.lines.update((prev) => [
      ...prev,
      {
        itemId,
        itemName: item.name,
        barcode: item.barcode ?? '',
        uomId: baseUom.uomId,
        uomName: baseUom.uomName,
        orderedQty: '',
        receivedQty: '',
        unitPrice: item.unitPrice ?? '',
      },
    ]);
    this.clearLineValidationUi();
    this.itemQuery.set('');
    this.itemResults.set([]);
    this.itemDropdownOpen.set(false);
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
    this.error.set('');
  }

  validateHeader(): boolean {
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

  handleManualNext(): void {
    this.error.set('');
    if (!this.validateHeader()) return;
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
    if (!this.invoiceFile()) {
      this.error.set(this.translate.instant('GRN.CREATE.ERROR_INVOICE'));
      return;
    }
    this.step.set(2);
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
    this.loading.set(true);
    const fd = new FormData();
    fd.append('file', file);
    fd.append('supplierId', this.supplierId());
    fd.append('locationId', this.locationId());
    fd.append('grnNumber', this.grnNumber().trim());
    fd.append('receivingDate', this.receivingDate());
    this.grnApi.importPreview(fd).subscribe({
      next: (data) => {
        this.preview.set(data);
        this.step.set(2);
        this.loading.set(false);
      },
      error: (err: { error?: { message?: string } }) => {
        this.loading.set(false);
        this.error.set(
          err?.error?.message ?? this.translate.instant('GRN.CREATE.ERROR_PREVIEW'),
        );
      },
    });
  }

  handleSubmit(): void {
    this.error.set('');
    if (!this.invoiceFile()) {
      this.error.set(this.translate.instant('GRN.CREATE.ERROR_INVOICE'));
      return;
    }

    if (this.mode() === 'manual') {
      const idCheck = this.validateManualLinesForIds();
      if (!idCheck.ok) {
        this.flagManualLineIdsError(idCheck.badIndexes, idCheck.firstBadName);
        this.step.set(1);
        return;
      }
      this.clearLineValidationUi();
    } else if (!this.validateExcelLinesForCreate()) {
      this.error.set(this.translate.instant('GRN.CREATE.ERROR_EXCEL_LINE_IDS'));
      this.message.error(this.translate.instant('GRN.CREATE.ERROR_EXCEL_LINE_IDS'));
      return;
    }

    this.loading.set(true);
    const form = new FormData();
    const inv = this.invoiceFile()!;
    form.append('invoice', inv);
    form.append('supplierId', this.supplierId());
    form.append('locationId', this.locationId());
    form.append('grnNumber', this.grnNumber().trim());
    form.append('receivingDate', this.receivingDate());
    form.append('notes', this.notes());

    if (this.mode() === 'manual') {
      const payload = this.lines()
        .filter((l) => this.isValidUuidString(l.itemId) && this.isValidUuidString(l.uomId))
        .map((l) => ({
          itemId: l.itemId.trim(),
          uomId: l.uomId.trim(),
          orderedQty: Number(l.orderedQty) || 0,
          receivedQty: Number(l.receivedQty),
          unitPrice: Number(l.unitPrice) || 0,
        }));
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
          .map((r) => ({
            itemId: r.itemId!.trim(),
            uomId: r.uomId!.trim(),
            orderedQty: Number(r.orderedQty) || 0,
            receivedQty: Number(r.receivedQty),
            unitPrice: Number(r.unitPrice) || 0,
          })) ?? [];
      form.append('lines', JSON.stringify(payload));
    }

    this.grnApi.create(form).subscribe({
      next: () => {
        const doneStep = this.mode() === 'manual' ? 3 : 4;
        this.step.set(doneStep);
        this.loading.set(false);
        setTimeout(() => this.created.emit(), 1400);
      },
      error: (err: { error?: { message?: string } }) => {
        this.loading.set(false);
        this.error.set(
          err?.error?.message ?? this.translate.instant('GRN.CREATE.ERROR_CREATE'),
        );
      },
    });
  }

  goBack(): void {
    this.step.update((s) => Math.max(1, s - 1));
    this.error.set('');
  }

  excelNextFromPreview(): void {
    const pv = this.preview();
    if (pv && pv.valid > 0) {
      this.step.set(3);
    }
  }

  close(): void {
    this.reset();
    this.closed.emit();
  }

  private reset(): void {
    this.mode.set('manual');
    this.step.set(1);
    this.supplierId.set('');
    this.locationId.set('');
    this.grnNumber.set('');
    this.receivingDate.set(this.todayIso());
    this.notes.set('');
    this.lines.set([]);
    this.clearLineValidationUi();
    this.invoiceFile.set(null);
    this.excelFile.set(null);
    this.preview.set(null);
    this.error.set('');
    this.loading.set(false);
    this.itemQuery.set('');
    this.itemResults.set([]);
    this.itemDropdownOpen.set(false);
  }

  private todayIso(): string {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  lineTotal(line: GrnManualLineDraft): number {
    return (Number(line.receivedQty) || 0) * (Number(line.unitPrice) || 0);
  }

  /** Accepts standard UUID strings (with or without hyphens) for Prisma @db.Uuid. */
  private isValidUuidString(value: string | undefined | null): boolean {
    if (value == null) {
      return false;
    }
    const hex = value.trim().replace(/-/g, '');
    return hex.length === 32 && /^[0-9a-fA-F]+$/.test(hex);
  }

  /**
   * BASE unit from `itemUnits`: supports `unitId` (detail/list) or nested `unit.id` (list).
   */
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
