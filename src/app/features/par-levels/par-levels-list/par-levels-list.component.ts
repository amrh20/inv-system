import { NgClass } from '@angular/common';
import {
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { first } from 'rxjs/operators';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { LucideAngularModule } from 'lucide-angular';
import {
  AlertTriangle,
  CheckSquare,
  GaugeCircle,
  Layers,
  Loader2,
  RefreshCw,
  Save,
  Search,
} from 'lucide-angular';
import type { DepartmentOption, LocationOption } from '../../items/models/item.model';
import type { CategoryRow } from '../../master-data/models/category.model';
import { ItemMasterLookupsService } from '../../items/services/item-master-lookups.service';
import { LocationsService } from '../../master-data/services/locations.service';
import type { LowStockItem, ParLevelRow, ParLevelUpdate } from '../models/par-level.model';
import { ParLevelService } from '../services/par-level.service';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';

/** Edit draft key: itemId_locationId */
type EditKey = string;

@Component({
  selector: 'app-par-levels-list',
  standalone: true,
  imports: [
    NgClass,
    FormsModule,
    NzAlertModule,
    NzButtonModule,
    NzInputModule,
    NzInputNumberModule,
    NzSelectModule,
    NzTableModule,
    TranslatePipe,
    LucideAngularModule,
    EmptyStateComponent,
  ],
  templateUrl: './par-levels-list.component.html',
  styleUrl: './par-levels-list.component.scss',
})
export class ParLevelsListComponent implements OnInit {
  private readonly parLevelApi = inject(ParLevelService);
  private readonly lookups = inject(ItemMasterLookupsService);
  private readonly locationsApi = inject(LocationsService);
  private readonly message = inject(NzMessageService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly translate = inject(TranslateService);

  readonly lucideGauge = GaugeCircle;
  readonly lucideSearch = Search;
  readonly lucideLoader = Loader2;
  readonly lucideRefresh = RefreshCw;
  readonly lucideSave = Save;
  readonly lucideAlert = AlertTriangle;
  readonly lucideLayers = Layers;
  readonly lucideCheckSquare = CheckSquare;

  readonly departments = signal<DepartmentOption[]>([]);
  readonly allLocations = signal<LocationOption[]>([]);
  readonly locationCategories = signal<CategoryRow[]>([]);

  readonly departmentId = signal('');
  readonly locationId = signal('');
  readonly filterCategoryId = signal('');
  readonly balances = signal<ParLevelRow[]>([]);
  readonly lowStockItems = signal<LowStockItem[]>([]);
  readonly loading = signal(false);
  readonly saving = signal(false);

  /** In-memory edits: { [itemId_locationId]: { minQty?, maxQty?, reorderPoint? } } */
  readonly edits = signal<Record<EditKey, Partial<ParLevelUpdate>>>({});

  readonly bulkCategoryId = signal('');
  readonly bulkMin = signal<number | null>(null);
  readonly bulkMax = signal<number | null>(null);
  readonly bulkReorder = signal<number | null>(null);
  readonly bulkApplied = signal(false);

  readonly filteredLocations = computed(() => {
    const dept = this.departmentId();
    const locs = this.allLocations();
    if (!dept) return locs;
    return locs.filter((l) => l.departmentId === dept);
  });

  readonly itemCategories = computed(() => {
    const rows = this.balances();
    const map = new Map<string, string>();
    for (const b of rows) {
      const cat = b.item?.category;
      if (cat?.id) map.set(cat.id, cat.name ?? cat.id);
    }
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  });

  readonly categoryOptions = computed(() => {
    const locCats = this.locationCategories();
    const itemCats = this.itemCategories();
    return locCats.length > 0 ? locCats : itemCats;
  });

  readonly filteredBalances = computed(() => {
    const rows = this.balances();
    const catId = this.filterCategoryId();
    if (!catId) return rows;
    return rows.filter((b) => b.item?.category?.id === catId);
  });

  readonly hasEdits = computed(() => Object.keys(this.edits()).length > 0);
  readonly editsCount = computed(() => Object.keys(this.edits()).length);

  readonly lowStockAlertMsg = computed(() =>
    this.translate.instant('PAR_LEVELS.LOW_STOCK_ALERT_MSG', {
      count: this.lowStockItems().length,
    }),
  );

  readonly lowStockAlertDesc = computed(() => {
    const items = this.lowStockItems().slice(0, 10);
    return items
      .map(
        (it) =>
          `${it.item?.name ?? it.itemId} – ${Number(it.qtyOnHand)} pcs @ ${it.location?.name ?? ''}: reorder ${Number(it.reorderPoint)} (min: ${Number(it.minQty)})`,
      )
      .join(' | ');
  });

  readonly categoryName = computed(() => {
    const catId = this.filterCategoryId();
    if (!catId) return '';
    const cat = this.itemCategories().find((c) => c.id === catId);
    return cat?.name ?? catId;
  });

  constructor() {
    effect(
      () => {
        const locId = this.locationId();
        if (!locId) {
          this.locationCategories.set([]);
          this.bulkCategoryId.set('');
          this.filterCategoryId.set('');
          return;
        }
        this.locationsApi
          .getCategories(locId)
          .pipe(first(), takeUntilDestroyed(this.destroyRef))
          .subscribe({
            next: (cats) => this.locationCategories.set(cats),
            error: () => this.locationCategories.set([]),
          });
      },
      { allowSignalWrites: true },
    );
  }

  ngOnInit(): void {
    this.loadFilterOptions();
    this.loadLowStock();
  }

  onDepartmentChange(deptId: string): void {
    this.departmentId.set(deptId);
    this.locationId.set('');
    this.balances.set([]);
    this.bulkCategoryId.set('');
    this.filterCategoryId.set('');
  }

  loadParLevels(): void {
    const locId = this.locationId();
    if (!locId) return;
    this.loading.set(true);
    this.parLevelApi
      .getParLevels(locId)
      .pipe(first(), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (rows) => {
          this.balances.set(rows);
          this.edits.set({});
          this.filterCategoryId.set('');
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
          this.message.error(this.t('PAR_LEVELS.ERROR_LOAD'));
        },
      });
  }

  loadLowStock(): void {
    this.parLevelApi
      .getLowStock()
      .pipe(first(), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (items) => this.lowStockItems.set(items),
        error: () => this.lowStockItems.set([]),
      });
  }

  handleEdit(
    itemId: string,
    locationId: string,
    field: 'minQty' | 'maxQty' | 'reorderPoint',
    value: number | string | null,
  ): void {
    const key = `${itemId}_${locationId}`;
    const num = value === '' || value === null ? 0 : Number(value) || 0;
    this.edits.update((prev) => ({
      ...prev,
      [key]: {
        ...(prev[key] ?? { itemId, locationId }),
        itemId,
        locationId,
        [field]: num,
      },
    }));
  }

  getEditValue(
    bal: ParLevelRow,
    field: 'minQty' | 'maxQty' | 'reorderPoint',
  ): number {
    const key = `${bal.itemId}_${bal.locationId}`;
    const edit = this.edits()[key];
    if (edit?.[field] !== undefined) return edit[field]!;
    return Number(bal[field]) || 0;
  }

  hasEdit(bal: ParLevelRow): boolean {
    return `${bal.itemId}_${bal.locationId}` in this.edits();
  }

  rowStatus(bal: ParLevelRow): 'low' | 'overstock' | 'ok' {
    const qty = Number(bal.qtyOnHand);
    const reorder = this.getEditValue(bal, 'reorderPoint');
    const max = this.getEditValue(bal, 'maxQty');
    if (reorder > 0 && qty <= reorder) return 'low';
    if (max > 0 && qty > max) return 'overstock';
    return 'ok';
  }

  handleBulkApply(): void {
    const bulkCat = this.bulkCategoryId();
    if (!bulkCat) return;
    const rows = this.balances();
    const targets = rows.filter(
      (b) =>
        b.item?.category?.id === bulkCat ||
        b.item?.category?.name === bulkCat,
    );
    if (targets.length === 0) {
      this.message.warning(this.t('PAR_LEVELS.BULK_NO_ITEMS'));
      return;
    }
    const min = this.bulkMin();
    const max = this.bulkMax();
    const reorder = this.bulkReorder();
    if (min === null && max === null && reorder === null) return;

    this.edits.update((prev) => {
      const next = { ...prev };
      for (const b of targets) {
        const key = `${b.itemId}_${b.locationId}`;
        next[key] = {
          itemId: b.itemId,
          locationId: b.locationId,
          ...(next[key] ?? {}),
          ...(min !== null ? { minQty: min } : {}),
          ...(max !== null ? { maxQty: max } : {}),
          ...(reorder !== null ? { reorderPoint: reorder } : {}),
        };
      }
      return next;
    });
    this.bulkApplied.set(true);
    setTimeout(() => this.bulkApplied.set(false), 2000);
  }

  handleSave(): void {
    const editMap = this.edits();
    const rows = this.balances();
    const rowMap = new Map(rows.map((r) => [`${r.itemId}_${r.locationId}`, r]));
    const updates: ParLevelUpdate[] = [];
    for (const [key, e] of Object.entries(editMap)) {
      if (!e?.itemId || !e?.locationId) continue;
      const base = rowMap.get(key);
      const min = e.minQty ?? (base ? Number(base.minQty) || 0 : 0);
      const max = e.maxQty ?? (base ? Number(base.maxQty) || 0 : 0);
      const reorder = e.reorderPoint ?? (base ? Number(base.reorderPoint) || 0 : 0);
      updates.push({
        itemId: e.itemId,
        locationId: e.locationId,
        minQty: min,
        maxQty: max,
        reorderPoint: reorder,
      });
    }
    if (updates.length === 0) return;
    this.saving.set(true);
    this.parLevelApi
      .updateParLevels(updates)
      .pipe(first(), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.message.success(this.t('PAR_LEVELS.SUCCESS_SAVED'));
          this.loadParLevels();
          this.loadLowStock();
        },
        error: (err) => {
          this.saving.set(false);
          this.message.error(
            err?.error?.error ?? this.t('PAR_LEVELS.ERROR_SAVE'),
          );
        },
      });
  }

  clearFilterCategory(): void {
    this.filterCategoryId.set('');
  }

  private loadFilterOptions(): void {
    this.lookups
      .listDepartments({ take: 200 })
      .pipe(first(), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (d) => this.departments.set(d),
        error: () => this.departments.set([]),
      });
    this.lookups
      .listLocations({ take: 200 })
      .pipe(first(), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (l) => this.allLocations.set(l),
        error: () => this.allLocations.set([]),
      });
  }

  private t(key: string, params?: Record<string, unknown>): string {
    return this.translate.instant(key, params);
  }
}
