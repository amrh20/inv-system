import { DatePipe, NgClass } from '@angular/common';
import {
  Component,
  effect,
  inject,
  OnDestroy,
  OnInit,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { first } from 'rxjs/operators';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { LucideAngularModule } from 'lucide-angular';
import {
  ArrowDownRight,
  ArrowRightLeft,
  ArrowUpRight,
  BookOpen,
  Filter,
  Loader2,
} from 'lucide-angular';
import type { LocationOption } from '../../items/models/item.models';
import { ItemMasterLookupsService } from '../../items/services/item-master-lookups.service';
import { ItemsService } from '../../items/services/items.service';
import type { LedgerEntryRow } from '../models/ledger-entry.model';
import { LedgerService } from '../services/ledger.service';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';

const LEDGER_FETCH_TAKE = 100;
const LEDGER_DEBOUNCE_MS = 300;

/** Movement types shown in ledger filter dropdown (aligned with React + Prisma) */
const LEDGER_MOVEMENT_TYPES = [
  'OPENING_BALANCE',
  'RECEIVE',
  'ISSUE',
  'TRANSFER_IN',
  'TRANSFER_OUT',
  'BREAKAGE',
  'ADJUSTMENT',
  'RETURN',
  'COUNT_ADJUSTMENT',
] as const;

@Component({
  selector: 'app-ledger-viewer',
  standalone: true,
  imports: [
    FormsModule,
    DatePipe,
    NgClass,
    NzAlertModule,
    NzButtonModule,
    NzDatePickerModule,
    NzSelectModule,
    NzTableModule,
    TranslatePipe,
    LucideAngularModule,
    EmptyStateComponent,
  ],
  templateUrl: './ledger-viewer.component.html',
  styleUrl: './ledger-viewer.component.scss',
})
export class LedgerViewerComponent implements OnInit, OnDestroy {
  readonly ledgerFetchTake = LEDGER_FETCH_TAKE;
  readonly movementTypes = LEDGER_MOVEMENT_TYPES;

  /** Horizontal scroll — column widths sum to ~1280px; extra room for padding/borders. */
  readonly ledgerTableScroll = { x: '1360px' };

  private readonly ledgerApi = inject(LedgerService);
  private readonly itemsApi = inject(ItemsService);
  private readonly lookups = inject(ItemMasterLookupsService);
  private readonly translate = inject(TranslateService);

  readonly lucideBook = BookOpen;
  readonly lucideFilter = Filter;
  readonly lucideLoader = Loader2;
  readonly lucideIn = ArrowDownRight;
  readonly lucideOut = ArrowUpRight;
  readonly lucideTransfer = ArrowRightLeft;

  readonly itemId = signal<string>('');
  readonly locationId = signal<string>('');
  readonly dateFrom = signal<Date | null>(null);
  readonly dateTo = signal<Date | null>(null);
  readonly movementType = signal<string>('');

  readonly entries = signal<LedgerEntryRow[]>([]);
  readonly total = signal(0);
  readonly loading = signal(false);
  readonly error = signal('');

  readonly itemOptions = signal<{ id: string; label: string }[]>([]);
  readonly locations = signal<LocationOption[]>([]);

  private debounceTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    effect(() => {
      this.itemId();
      this.locationId();
      this.dateFrom();
      this.dateTo();
      this.movementType();
      this.scheduleLoad();
    });
  }

  ngOnInit(): void {
    this.loadLookups();
  }

  ngOnDestroy(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
  }

  private scheduleLoad(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = null;
      this.loadEntries();
    }, LEDGER_DEBOUNCE_MS);
  }

  loadEntries(): void {
    this.loading.set(true);
    this.error.set('');
    const df = this.dateFrom();
    const dt = this.dateTo();
    this.ledgerApi
      .list({
        itemId: this.itemId() || undefined,
        locationId: this.locationId() || undefined,
        dateFrom: df ? this.formatDate(df) : undefined,
        dateTo: dt ? this.formatDate(dt) : undefined,
        movementType: this.movementType() || undefined,
        skip: 0,
        take: LEDGER_FETCH_TAKE,
      })
      .pipe(first())
      .subscribe({
        next: (res) => {
          this.entries.set(res.entries);
          this.total.set(res.total);
          this.loading.set(false);
        },
        error: (err: { error?: { message?: string } }) => {
          this.loading.set(false);
          this.error.set(err?.error?.message ?? this.t('LEDGER.ERROR_LOAD'));
        },
      });
  }

  private formatDate(d: Date): string {
    return d.toISOString().slice(0, 10);
  }

  rowDirection(row: LedgerEntryRow): 'IN' | 'OUT' | 'TRANSFER' {
    if (row.movementType === 'TRANSFER_IN' || row.movementType === 'TRANSFER_OUT') {
      return 'TRANSFER';
    }
    return Number(row.qtyIn) > 0 ? 'IN' : 'OUT';
  }

  rowTypeIcon(row: LedgerEntryRow) {
    const d = this.rowDirection(row);
    if (d === 'TRANSFER') {
      return this.lucideTransfer;
    }
    return d === 'IN' ? this.lucideIn : this.lucideOut;
  }

  rowTypeStatusClass(row: LedgerEntryRow): string {
    const d = this.rowDirection(row);
    if (d === 'TRANSFER') {
      return 'processing';
    }
    return d === 'IN' ? 'success' : 'error';
  }

  movementTypeClass(row: LedgerEntryRow): string {
    switch (row.movementType) {
      case 'OPENING_BALANCE':
        return 'ledger-type--opening';
      case 'RECEIVE':
        return 'ledger-type--receive';
      case 'ISSUE':
        return 'ledger-type--issue';
      case 'TRANSFER_IN':
        return 'ledger-type--transfer-in';
      case 'TRANSFER_OUT':
        return 'ledger-type--transfer-out';
      case 'BREAKAGE':
        return 'ledger-type--breakage';
      case 'ADJUSTMENT':
        return 'ledger-type--adjustment';
      case 'RETURN':
        return 'ledger-type--return';
      case 'COUNT_ADJUSTMENT':
        return 'ledger-type--count-adjustment';
      default:
        return 'ledger-type--default';
    }
  }

  movementTypeHuman(row: LedgerEntryRow): string {
    return this.t(`MOVEMENTS.TYPES.${row.movementType}`);
  }

  formatSignedQtyIn(row: LedgerEntryRow): string {
    const v = Number(row.qtyIn);
    return v > 0 ? `+${v.toLocaleString('en-US', { maximumFractionDigits: 4 })}` : '—';
  }

  formatSignedQtyOut(row: LedgerEntryRow): string {
    const v = Number(row.qtyOut);
    return v > 0 ? `-${v.toLocaleString('en-US', { maximumFractionDigits: 4 })}` : '—';
  }

  isQtyOutPositive(row: LedgerEntryRow): boolean {
    return Number(row.qtyOut) > 0;
  }

  formatBalance(row: LedgerEntryRow): string {
    const b = row.runningBalance;
    if (b === undefined || b === null) {
      return '—';
    }
    return Number(b).toLocaleString('en-US', { maximumFractionDigits: 4 });
  }

  formatUnitCost(row: LedgerEntryRow): string {
    const v = Number(row.unitCost);
    return v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  formatTotalValue(row: LedgerEntryRow): string {
    const v = Number(row.totalValue);
    return v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  movementTypeLabel(type: string): string {
    return type ? this.t(`MOVEMENTS.TYPES.${type}`) : '';
  }

  downloadExcel(): void {
    const rows = this.entries();
    const headers = [
      this.t('COMMON.DATE'),
      this.t('COMMON.TYPE'),
      this.t('LEDGER.REF_NO'),
      this.t('COMMON.ITEM'),
      this.t('COMMON.LOCATION'),
      this.t('COMMON.QTY_IN'),
      this.t('COMMON.QTY_OUT'),
      this.t('COMMON.UNIT_COST'),
      this.t('COMMON.TOTAL_VALUE'),
      this.t('LEDGER.RUNNING_BAL'),
    ];

    const csvRows = rows.map((row) => [
      this.formatDateTimeCsv(row.createdAt),
      this.movementTypeHuman(row),
      row.referenceNo ?? '',
      row.item?.name ?? '',
      row.location?.name ?? '',
      this.formatSignedQtyIn(row),
      this.formatSignedQtyOut(row),
      this.formatUnitCost(row),
      this.formatTotalValue(row),
      this.formatBalance(row),
    ]);

    const csvContent = [headers, ...csvRows].map((line) => line.map((v) => this.escapeCsv(v)).join(',')).join('\r\n');
    const csvWithBom = `\uFEFF${csvContent}`;
    const blob = new Blob([csvWithBom], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ledger-${this.formatDate(new Date())}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  private loadLookups(): void {
    this.itemsApi
      .getItems({ take: 500 })
      .pipe(first())
      .subscribe({
        next: (res) => {
          this.itemOptions.set(
            res.items.map((i) => ({
              id: i.id,
              label: i.barcode ? `${i.name} (${i.barcode})` : i.name,
            })),
          );
        },
        error: () => this.itemOptions.set([]),
      });
    this.lookups
      .listLocations({ take: 200 })
      .pipe(first())
      .subscribe({
        next: (l) => this.locations.set(l),
        error: () => this.locations.set([]),
      });
  }

  private t(key: string, params?: Record<string, unknown>): string {
    return this.translate.instant(key, params);
  }

  private formatDateTimeCsv(value: string): string {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString();
  }

  private escapeCsv(value: unknown): string {
    const raw = String(value ?? '');
    const escaped = raw.replace(/"/g, '""');
    return /[",\r\n]/.test(escaped) ? `"${escaped}"` : escaped;
  }
}
