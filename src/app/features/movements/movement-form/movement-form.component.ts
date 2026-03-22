import {
  Component,
  computed,
  DestroyRef,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NgClass } from '@angular/common';
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
import type { LocationOption } from '../../items/models/item.model';
import { ItemMasterLookupsService } from '../../items/services/item-master-lookups.service';
import { ItemsService } from '../../items/services/items.service';
import { ConfirmationService } from '../../../core/services/confirmation.service';
import type {
  MovementDocumentDetail,
  MovementDocumentPayload,
  MovementLinePayload,
} from '../models/movement-document.model';
import { MovementDocumentsService } from '../services/movement-documents.service';

const MOVEMENT_TYPES = [{ value: 'ADJUSTMENT', label: 'MOVEMENTS.TYPES.ADJUSTMENT' }];

@Component({
  selector: 'app-movement-form',
  standalone: true,
  providers: [ConfirmationService],
  imports: [
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

  readonly movementTypes = MOVEMENT_TYPES;

  readonly id = signal<string | null>(null);
  readonly isNew = computed(() => this.id() === 'new');
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly postResult = signal<{ success: boolean; message: string } | null>(null);

  readonly currentDoc = signal<MovementDocumentDetail | null>(null);
  readonly items = signal<ItemListRow[]>([]);
  readonly locations = signal<LocationOption[]>([]);
  readonly ledgerEntries = signal<LedgerEntryRow[]>([]);

  readonly form = signal<MovementDocumentPayload>({
    movementType: 'ADJUSTMENT',
    documentDate: new Date().toISOString().split('T')[0],
    sourceLocationId: null,
    destLocationId: null,
    referenceNumber: '',
    department: '',
    notes: '',
    lines: [],
  });

  readonly isReadOnly = computed(() => this.currentDoc()?.status === 'POSTED');
  readonly showSourceLoc = computed(() =>
    ['RETURN', 'ADJUSTMENT'].includes(this.form().movementType),
  );
  readonly showDestLoc = computed(() =>
    ['OPENING_BALANCE', 'RETURN'].includes(this.form().movementType),
  );

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
  }

  private loadDocument(id: string): void {
    this.loading.set(true);
    this.docsApi
      .getById(id)
      .pipe(first())
      .subscribe({
        next: (doc) => {
          this.currentDoc.set(doc);
          this.form.set({
            movementType: doc.movementType,
            documentDate: doc.documentDate ? doc.documentDate.split('T')[0] : '',
            sourceLocationId: doc.sourceLocationId ?? null,
            destLocationId: doc.destLocationId ?? null,
            referenceNumber: doc.referenceNumber ?? '',
            department: doc.department ?? '',
            notes: doc.notes ?? '',
            lines: (doc.lines ?? []).map((l) => ({
              itemId: l.itemId,
              locationId: l.locationId ?? null,
              qtyRequested: l.qtyRequested,
              unitCost: l.unitCost ?? 0,
              totalValue: l.totalValue ?? 0,
              notes: l.notes ?? '',
            })),
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

  onFieldChange<K extends keyof MovementDocumentPayload>(field: K, value: MovementDocumentPayload[K]): void {
    this.form.update((f) => ({ ...f, [field]: value }));
  }

  onLineChange(index: number, field: keyof MovementLinePayload, value: unknown): void {
    this.form.update((f) => {
      const lines = [...f.lines];
      const line = { ...lines[index], [field]: value };
      if (field === 'qtyRequested' || field === 'unitCost') {
        const qty = Number(line.qtyRequested) || 0;
        const cost = Number(line.unitCost) || 0;
        line.totalValue = qty * cost;
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
    const payload = this.form();
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
            next: (doc) => {
              this.saving.set(false);
              this.currentDoc.set(doc);
              this.postResult.set({
                success: true,
                message: this.t('MOVEMENTS.SUCCESS_POSTED'),
              });
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
}
