import {
  Component,
  DestroyRef,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { LucideAngularModule } from 'lucide-angular';
import { ArrowLeft, Plus, Save, Trash2 } from 'lucide-angular';
import type { LocationRow } from '../../master-data/models/location.model';
import type { UnitRow } from '../../master-data/models/unit.model';
import { LocationsService } from '../../master-data/services/locations.service';
import { UnitsService } from '../../master-data/services/units.service';
import { StockService } from '../../stock/services/stock.service';
import type { TransferCreatePayload, TransferUpdatePayload } from '../models/transfer.model';
import { TransferService } from '../services/transfer.service';

interface LineDraft {
  itemId: string;
  uomId: string;
  requestedQty: number | null;
  notes: string;
}

@Component({
  selector: 'app-transfer-form',
  standalone: true,
  imports: [
    FormsModule,
    NzAlertModule,
    NzButtonModule,
    NzInputModule,
    NzInputNumberModule,
    NzSelectModule,
    NzTableModule,
    TranslatePipe,
    LucideAngularModule,
  ],
  templateUrl: './transfer-form.component.html',
  styleUrl: './transfer-form.component.scss',
})
export class TransferFormComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly api = inject(TransferService);
  private readonly locationsApi = inject(LocationsService);
  private readonly unitsApi = inject(UnitsService);
  private readonly stockApi = inject(StockService);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);

  readonly lucideBack = ArrowLeft;
  readonly lucideSave = Save;
  readonly lucidePlus = Plus;
  readonly lucideTrash = Trash2;

  readonly locations = signal<LocationRow[]>([]);
  readonly units = signal<UnitRow[]>([]);
  readonly stockItems = signal<Array<{ id: string; label: string }>>([]);
  /** Loading balances for the selected source location (item pick list). */
  readonly itemsLoading = signal(false);

  readonly sourceLocationId = signal('');
  readonly destLocationId = signal('');
  readonly reason = signal('');
  readonly notes = signal('');
  readonly lines = signal<LineDraft[]>([]);

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal('');

  readonly editId = signal<string | null>(null);

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) this.editId.set(id);

    forkJoin({
      loc: this.locationsApi.list({ take: 500, isActive: true }),
      uni: this.unitsApi.list({ take: 500, isActive: true }),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ loc, uni }) => {
          this.locations.set(loc.locations);
          this.units.set(uni.units);
          if (id) {
            this.loadTransfer(id);
          } else {
            this.loading.set(false);
          }
        },
        error: () => {
          this.error.set(this.translate.instant('TRANSFER.FORM.ERROR_LOOKUPS'));
          this.loading.set(false);
        },
      });
  }

  private loadTransfer(id: string): void {
    this.api
      .getById(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (t) => {
          if (t.status !== 'DRAFT') {
            this.error.set(this.translate.instant('TRANSFER.FORM.ERROR_NOT_DRAFT'));
            this.loading.set(false);
            return;
          }
          this.sourceLocationId.set(t.sourceLocationId ?? '');
          this.destLocationId.set(t.destLocationId ?? '');
          this.reason.set(t.reason ?? '');
          this.notes.set(t.notes ?? '');
          this.lines.set(
            (t.lines ?? []).map((l) => ({
              itemId: l.itemId,
              uomId: l.uomId,
              requestedQty: Number(l.requestedQty),
              notes: l.notes ?? '',
            })),
          );
          const src = t.sourceLocationId ?? '';
          if (src) this.refreshStockItems(src);
          this.loading.set(false);
        },
        error: () => {
          this.error.set(this.translate.instant('TRANSFER.FORM.ERROR_LOAD'));
          this.loading.set(false);
        },
      });
  }

  back(): void {
    this.router.navigate(['/transfers']);
  }

  onSourceChange(id: string): void {
    this.sourceLocationId.set(id ?? '');
    this.refreshStockItems(id ?? '');
  }

  setDest(id: string): void {
    this.destLocationId.set(id ?? '');
  }

  private refreshStockItems(locationId: string): void {
    if (!locationId) {
      this.stockItems.set([]);
      this.itemsLoading.set(false);
      return;
    }
    this.itemsLoading.set(true);
    this.stockApi
      .getStockBalances({
        locationId,
        take: 5000,
        showZero: 'false',
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ balances }) => {
          const items = balances
            .filter((b) => Number(b.qtyOnHand) > 0)
            .map((b) => ({
              id: b.itemId,
              label: `${b.item?.name ?? b.itemId} (${Number(b.qtyOnHand).toFixed(0)} ${this.translate.instant('TRANSFER.FORM.ON_HAND_SUFFIX')})`,
            }));
          this.stockItems.set(items);
          this.itemsLoading.set(false);
        },
        error: () => {
          this.stockItems.set([]);
          this.itemsLoading.set(false);
        },
      });
  }

  destOptions(): LocationRow[] {
    const src = this.sourceLocationId();
    return this.locations().filter((l) => l.id !== src);
  }

  defaultUomId(): string {
    return this.units()[0]?.id ?? '';
  }

  addLine(): void {
    const u = this.defaultUomId();
    this.lines.update((ls) => [...ls, { itemId: '', uomId: u, requestedQty: null, notes: '' }]);
  }

  removeLine(index: number): void {
    this.lines.update((ls) => ls.filter((_, i) => i !== index));
  }

  updateLine(index: number, patch: Partial<LineDraft>): void {
    this.lines.update((ls) => {
      const next = [...ls];
      next[index] = { ...next[index], ...patch };
      return next;
    });
  }

  onLineItemChange(index: number, itemId: string): void {
    const u = this.defaultUomId();
    this.updateLine(index, { itemId, uomId: u || this.lines()[index]?.uomId });
  }

  save(andSubmit: boolean): void {
    const src = this.sourceLocationId();
    const dst = this.destLocationId();
    if (!src || !dst) {
      this.error.set(this.translate.instant('TRANSFER.FORM.ERROR_LOCATIONS'));
      return;
    }
    if (src === dst) {
      this.error.set(this.translate.instant('TRANSFER.FORM.ERROR_SAME_LOCATION'));
      return;
    }
    const ls = this.lines();
    if (ls.length === 0) {
      this.error.set(this.translate.instant('TRANSFER.FORM.ERROR_LINES'));
      return;
    }
    for (const line of ls) {
      if (!line.itemId || !line.uomId || line.requestedQty == null || line.requestedQty <= 0) {
        this.error.set(this.translate.instant('TRANSFER.FORM.ERROR_LINE_INCOMPLETE'));
        return;
      }
    }

    const body: TransferCreatePayload = {
      sourceLocationId: src,
      destLocationId: dst,
      reason: this.reason().trim() || undefined,
      notes: this.notes().trim() || undefined,
      lines: ls.map((l) => ({
        itemId: l.itemId,
        uomId: l.uomId,
        requestedQty: Number(l.requestedQty),
        notes: l.notes.trim() || undefined,
      })),
    };

    const id = this.editId();
    this.saving.set(true);
    this.error.set('');

    if (id) {
      const patch: TransferUpdatePayload = {
        sourceLocationId: body.sourceLocationId,
        destLocationId: body.destLocationId,
        reason: body.reason,
        notes: body.notes,
        lines: body.lines,
      };
      this.api
        .update(id, patch)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: () => this.afterSave(id, andSubmit),
          error: (err: { error?: { message?: string } }) => {
            this.saving.set(false);
            this.error.set(err?.error?.message ?? this.translate.instant('TRANSFER.FORM.ERROR_SAVE'));
          },
        });
    } else {
      this.api
        .create(body)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (created) => this.afterSave(created.id, andSubmit),
          error: (err: { error?: { message?: string } }) => {
            this.saving.set(false);
            this.error.set(err?.error?.message ?? this.translate.instant('TRANSFER.FORM.ERROR_SAVE'));
          },
        });
    }
  }

  private afterSave(id: string, andSubmit: boolean): void {
    if (!andSubmit) {
      this.saving.set(false);
      this.router.navigate(['/transfers', id]);
      return;
    }
    this.api
      .postAction(id, 'submit')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.router.navigate(['/transfers', id]);
        },
        error: (err: { error?: { message?: string } }) => {
          this.saving.set(false);
          this.error.set(err?.error?.message ?? this.translate.instant('TRANSFER.FORM.ERROR_SUBMIT'));
          this.router.navigate(['/transfers', id]);
        },
      });
  }
}
