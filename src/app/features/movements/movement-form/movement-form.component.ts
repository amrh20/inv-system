import {
  Component,
  computed,
  DestroyRef,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe, DecimalPipe, NgClass } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { first } from 'rxjs/operators';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { LucideAngularModule } from 'lucide-angular';
import {
  ArrowDownRight,
  ArrowLeft,
  ArrowUpRight,
  BookOpen,
  CheckCircle,
  Loader2,
  Plus,
  Save,
  Trash2,
} from 'lucide-angular';
import type { LedgerEntryRow } from '../../ledger/models/ledger-entry.model';
import { LedgerService } from '../../ledger/services/ledger.service';
import type { ItemListRow } from '../../items/models/item.model';
import type { LocationOption, SupplierOption } from '../../items/models/item.model';
import { ItemMasterLookupsService } from '../../items/services/item-master-lookups.service';
import { ItemsService } from '../../items/services/items.service';
import { ConfirmationService } from '../../../core/services/confirmation.service';
import type {
  MovementDocumentDetail,
  MovementDocumentPayload,
  MovementFormState,
  MovementLineDetail,
  MovementLineFormRow,
  MovementLinePayload,
} from '../models/movement-document.model';
import { MovementDocumentsService } from '../services/movement-documents.service';

/** All movement types selectable on new documents; labels via `MOVEMENTS.TYPES.*`. */
const MOVEMENT_TYPE_VALUES: readonly string[] = [
  'OPENING_BALANCE',
  'RECEIVE',
  'ISSUE',
  'TRANSFER_OUT',
  'TRANSFER_IN',
  'RETURN',
  'ADJUSTMENT',
  'BREAKAGE',
  'COUNT_ADJUSTMENT',
  'TRANSFER',
  'LOAN_WRITE_OFF',
  'GET_PASS_OUT',
  'GET_PASS_RETURN',
];

@Component({
  selector: 'app-movement-form',
  standalone: true,
  providers: [ConfirmationService],
  imports: [
    DatePipe,
    DecimalPipe,
    FormsModule,
    NgClass,
    NzAlertModule,
    NzButtonModule,
    NzInputModule,
    NzInputNumberModule,
    NzModalModule,
    NzSelectModule,
    NzTableModule,
    NzTagModule,
    TranslatePipe,
    LucideAngularModule,
  ],
  templateUrl: './movement-form.component.html',
  styleUrl: './movement-form.component.scss',
})
export class MovementFormComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly docsApi = inject(MovementDocumentsService);
  private readonly ledgerApi = inject(LedgerService);
  private readonly itemsApi = inject(ItemsService);
  private readonly lookups = inject(ItemMasterLookupsService);
  private readonly message = inject(NzMessageService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly translate = inject(TranslateService);
  private readonly confirmation = inject(ConfirmationService);

  readonly lucideArrowLeft = ArrowLeft;
  readonly lucideSave = Save;
  readonly lucideCheck = CheckCircle;
  readonly lucideLoader = Loader2;
  readonly lucidePlus = Plus;
  readonly lucideTrash = Trash2;
  readonly lucideBook = BookOpen;
  readonly lucideIn = ArrowDownRight;
  readonly lucideOut = ArrowUpRight;

  readonly movementTypeValues = MOVEMENT_TYPE_VALUES;

  readonly id = signal<string | null>(null);
  readonly isNew = computed(() => this.id() === 'new');
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly postResult = signal<{ success: boolean; message: string } | null>(null);

  readonly currentDoc = signal<MovementDocumentDetail | null>(null);
  readonly items = signal<ItemListRow[]>([]);
  readonly locations = signal<LocationOption[]>([]);
  readonly suppliers = signal<SupplierOption[]>([]);
  readonly ledgerEntries = signal<LedgerEntryRow[]>([]);

  readonly form = signal<MovementFormState>({
    movementType: 'ADJUSTMENT',
    documentDate: new Date().toISOString().split('T')[0],
    sourceLocationId: null,
    destLocationId: null,
    supplierId: null,
    referenceNumber: '',
    department: '',
    notes: '',
    lines: [],
  });

  readonly isReadOnly = computed(() => this.currentDoc()?.status === 'POSTED');
  readonly showSourceLoc = computed(() =>
    ['RETURN', 'ADJUSTMENT', 'TRANSFER_OUT'].includes(this.form().movementType),
  );
  readonly showDestLoc = computed(() =>
    ['OPENING_BALANCE', 'RETURN', 'RECEIVE', 'TRANSFER_IN'].includes(this.form().movementType),
  );

  /** Supplier: editable for RECEIVE; read-only row only when a supplier id exists (skip empty OB). */
  readonly showSupplierSection = computed(() => {
    const sid = this.form().supplierId;
    const hasSupplier = sid != null && String(sid).trim() !== '';
    if (this.isReadOnly()) {
      return hasSupplier;
    }
    return this.form().movementType === 'RECEIVE' || hasSupplier;
  });

  ngOnInit(): void {
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const id = params.get('id') ?? 'new';
      this.id.set(id);
      this.postResult.set(null);
      this.error.set('');

      this.loadLookups();

      if (id === 'new') {
        this.loading.set(false);
        this.form.set({
          movementType: 'ADJUSTMENT',
          documentDate: new Date().toISOString().split('T')[0],
          sourceLocationId: null,
          destLocationId: null,
          supplierId: null,
          referenceNumber: '',
          department: '',
          notes: '',
          lines: [],
        });
      } else {
        this.loadDocument(id);
      }
    });
  }

  private loadLookups(): void {
    this.itemsApi
      .list({ take: 500 })
      .pipe(first())
      .subscribe({
        next: (res) => this.items.set(res.items),
        error: () => this.items.set([]),
      });
    this.lookups
      .listLocations({ take: 200 })
      .pipe(first())
      .subscribe({
        next: (l) => this.locations.set(l),
        error: () => this.locations.set([]),
      });
    this.lookups
      .listSuppliers({ take: 300 })
      .pipe(first())
      .subscribe({
        next: (s) => this.suppliers.set(s),
        error: () => this.suppliers.set([]),
      });
  }

  private loadDocument(id: string): void {
    this.loading.set(true);
    this.docsApi
      .getById(id)
      .pipe(first())
      .subscribe({
        next: (doc) => {
          this.currentDoc.set(doc);
          const reasonText = (doc.reason ?? doc.referenceNumber ?? '').trim();
          this.form.set({
            movementType: doc.movementType,
            documentDate: this.normalizeDocumentDateInput(doc.documentDate),
            sourceLocationId: doc.sourceLocationId ?? null,
            destLocationId: doc.destLocationId ?? null,
            supplierId: doc.supplierId ?? null,
            referenceNumber: reasonText,
            department: doc.department ?? '',
            notes: doc.notes ?? '',
            lines: (doc.lines ?? []).map((l) => this.mapApiLineToFormRow(l)),
          });
          this.loading.set(false);

          if (doc.status === 'POSTED') {
            this.ledgerApi
              .byDocument(id)
              .pipe(first())
              .subscribe({
                next: (entries) => this.ledgerEntries.set(entries),
                error: () => this.ledgerEntries.set([]),
              });
          }
        },
        error: (err: { error?: { message?: string } }) => {
          this.loading.set(false);
          this.error.set(err?.error?.message ?? this.t('MOVEMENTS.ERROR_LOAD_DOCUMENT'));
        },
      });
  }

  onFieldChange<K extends keyof MovementFormState>(field: K, value: MovementFormState[K]): void {
    this.form.update((f) => ({ ...f, [field]: value }));
  }

  onLineChange(index: number, field: keyof MovementLineFormRow, value: unknown): void {
    this.form.update((f) => {
      const lines = [...f.lines];
      const line = { ...lines[index], [field]: value } as MovementLineFormRow;
      if (field === 'qtyRequested' || field === 'unitCost') {
        const qty = Number(line.qtyRequested) || 0;
        const cost = Number(line.unitCost) || 0;
        line.totalValue = qty * cost;
        line.qtyInBaseUnitSnapshot = qty;
      }
      lines[index] = line;
      return { ...f, lines };
    });
  }

  addLine(): void {
    this.form.update((f) => ({
      ...f,
      lines: [
        ...f.lines,
        {
          itemId: '',
          locationId: null,
          qtyRequested: 1,
          unitCost: 0,
          totalValue: 0,
          notes: '',
          itemNameSnapshot: '',
          lineLocationNameSnapshot: '',
          qtyInBaseUnitSnapshot: 1,
        },
      ],
    }));
  }

  removeLine(index: number): void {
    this.form.update((f) => ({
      ...f,
      lines: f.lines.filter((_, i) => i !== index),
    }));
  }

  itemLabel(item: ItemListRow): string {
    return item.barcode ? `${item.name} (${item.barcode})` : item.name;
  }

  getItemById(itemId: string): ItemListRow | undefined {
    return this.items().find((i) => i.id === itemId);
  }

  saveDraft(): void {
    const payload = this.toApiPayload(this.form());
    if (this.isNew()) {
      this.saving.set(true);
      this.error.set('');
      this.docsApi
        .create(payload)
        .pipe(first())
        .subscribe({
          next: (doc) => {
            this.saving.set(false);
            this.message.success(this.t('MOVEMENTS.SUCCESS_DRAFT_SAVED'));
            this.router.navigate(['/movements', doc.id]);
          },
          error: (err: { error?: { message?: string } }) => {
            this.saving.set(false);
            this.error.set(err?.error?.message ?? this.t('MOVEMENTS.ERROR_CREATE'));
          },
        });
    } else {
      const docId = this.id();
      if (!docId) return;
      this.saving.set(true);
      this.error.set('');
      this.docsApi
        .update(docId, payload)
        .pipe(first())
        .subscribe({
          next: () => {
            this.saving.set(false);
            this.message.success(this.t('MOVEMENTS.SUCCESS_DRAFT_UPDATED'));
            this.loadDocument(docId);
          },
          error: (err: { error?: { message?: string } }) => {
            this.saving.set(false);
            this.error.set(err?.error?.message ?? this.t('MOVEMENTS.ERROR_UPDATE'));
          },
        });
    }
  }

  postDocument(): void {
    const docId = this.id();
    if (!docId || this.isNew()) return;
    this.confirmation
      .confirm({
        title: this.t('MOVEMENTS.CONFIRM_POST_TITLE'),
        message: this.t('MOVEMENTS.CONFIRM_POST_MESSAGE'),
        confirmText: this.t('MOVEMENTS.POST_DOCUMENT'),
        cancelText: this.t('COMMON.CANCEL'),
      })
      .pipe(first())
      .subscribe((confirmed) => {
        if (!confirmed) {
          return;
        }
        this.saving.set(true);
        this.error.set('');
        this.docsApi
          .post(docId)
          .pipe(first())
          .subscribe({
            next: () => {
              this.saving.set(false);
              this.postResult.set({
                success: true,
                message: this.t('MOVEMENTS.SUCCESS_POSTED'),
              });
              this.loadDocument(docId);
              this.ledgerApi
                .byDocument(docId)
                .pipe(first())
                .subscribe({ next: (e) => this.ledgerEntries.set(e) });
            },
            error: (err: { error?: { message?: string } }) => {
              this.saving.set(false);
              this.error.set(err?.error?.message ?? this.t('MOVEMENTS.ERROR_POST'));
            },
          });
      });
  }

  goBack(): void {
    this.router.navigate(['/movements']);
  }

  qtyIn(entry: LedgerEntryRow): number {
    return Number(entry.qtyIn) || 0;
  }

  qtyOut(entry: LedgerEntryRow): number {
    return Number(entry.qtyOut) || 0;
  }

  totalValue(entry: LedgerEntryRow): string {
    const v = Number(entry.totalValue);
    return isNaN(v) ? '—' : v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' SAR';
  }

  unitCostFmt(entry: LedgerEntryRow): string {
    const v = Number(entry.unitCost);
    return isNaN(v) ? '—' : v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  private t(key: string, params?: Record<string, unknown>): string {
    return this.translate.instant(key, params);
  }

  movementTypeLabel(type: string): string {
    const key = `MOVEMENTS.TYPES.${type}`;
    const translated = this.translate.instant(key);
    return translated === key ? type : translated;
  }

  locationName(id: string | null | undefined): string {
    if (id == null || String(id).trim() === '') {
      return '—';
    }
    return this.locations().find((l) => l.id === id)?.name ?? '—';
  }

  supplierName(id: string | null | undefined): string {
    if (id == null || String(id).trim() === '') {
      return '—';
    }
    return this.suppliers().find((s) => s.id === id)?.name ?? '—';
  }

  lineItemDisplayName(line: MovementLineFormRow): string {
    if (line.itemNameSnapshot?.trim()) {
      return line.itemNameSnapshot;
    }
    const item = this.getItemById(line.itemId);
    return item ? this.itemLabel(item) : '—';
  }

  lineQtyBaseDisplay(line: MovementLineFormRow): number {
    const snap = line.qtyInBaseUnitSnapshot;
    if (snap != null && Number.isFinite(snap)) {
      return snap;
    }
    return Number(line.qtyRequested) || 0;
  }

  private normalizeDocumentDateInput(raw: string | null | undefined): string {
    if (!raw) {
      return new Date().toISOString().split('T')[0];
    }
    if (raw.includes('T')) {
      return raw.split('T')[0]!;
    }
    return raw.length >= 10 ? raw.slice(0, 10) : raw;
  }

  private num(v: unknown): number {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }

  private mapApiLineToFormRow(l: MovementLineDetail): MovementLineFormRow {
    const qtyBase = this.num(l.qtyInBaseUnit ?? l.qtyRequested);
    const uc = this.num(l.unitCost);
    const tv = this.num(l.totalValue) || qtyBase * uc;
    return {
      itemId: l.itemId,
      locationId: l.locationId ?? null,
      qtyRequested: qtyBase,
      unitCost: uc,
      totalValue: tv,
      notes: l.notes ?? '',
      itemNameSnapshot: l.item?.name ?? '',
      lineLocationNameSnapshot: l.location?.name ?? '',
      qtyInBaseUnitSnapshot: qtyBase,
    };
  }

  private toApiPayload(f: MovementFormState): MovementDocumentPayload {
    return {
      movementType: f.movementType,
      documentDate: f.documentDate,
      sourceLocationId: f.sourceLocationId?.trim() ? f.sourceLocationId : null,
      destLocationId: f.destLocationId?.trim() ? f.destLocationId : null,
      supplierId: f.supplierId?.trim() ? f.supplierId : null,
      reason: f.referenceNumber?.trim() || null,
      department: f.department?.trim() || null,
      notes: f.notes?.trim() || null,
      lines: f.lines.map((row) => ({
        itemId: row.itemId,
        locationId: row.locationId?.trim() ? row.locationId : null,
        qtyRequested: Number(row.qtyRequested) || 0,
        unitCost: Number(row.unitCost) || 0,
        totalValue: Number(row.totalValue) || 0,
        notes: row.notes?.trim() || null,
      })),
    };
  }
}
