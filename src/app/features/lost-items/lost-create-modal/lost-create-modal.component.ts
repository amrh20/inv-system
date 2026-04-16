import { Component, DestroyRef, effect, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { of, Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap } from 'rxjs/operators';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTableModule } from 'ng-zorro-antd/table';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { LucideAngularModule } from 'lucide-angular';
import { AlertTriangle, Plus, Trash2 } from 'lucide-angular';
import type { CategoryRow } from '../../master-data/models/category.model';
import type { DepartmentRow } from '../../master-data/models/department.model';
import type { LocationRow } from '../../master-data/models/location.model';
import {
  InventoryService,
  type ItemByLocationSelectRow,
} from '../../inventory/services/inventory.service';
import { CategoriesService } from '../../master-data/services/categories.service';
import { DepartmentsService } from '../../master-data/services/departments.service';
import { LocationsService } from '../../master-data/services/locations.service';
import { LostItemsService } from '../services/lost-items.service';

interface LineDraft {
  itemId: string;
  name: string;
  barcode?: string | null;
  availableQty: number;
  qty: number;
  notes: string;
}

@Component({
  selector: 'app-lost-create-modal',
  standalone: true,
  imports: [
    FormsModule,
    NzButtonModule,
    NzDatePickerModule,
    NzInputModule,
    NzInputNumberModule,
    NzModalModule,
    NzSelectModule,
    NzSpinModule,
    NzTableModule,
    TranslatePipe,
    LucideAngularModule,
  ],
  templateUrl: './lost-create-modal.component.html',
  styleUrl: './lost-create-modal.component.scss',
})
export class LostCreateModalComponent {
  private readonly departmentsApi = inject(DepartmentsService);
  private readonly categoriesApi = inject(CategoriesService);
  private readonly locationsApi = inject(LocationsService);
  private readonly inventoryApi = inject(InventoryService);
  private readonly lostApi = inject(LostItemsService);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);

  readonly open = input.required<boolean>();
  readonly closed = output<void>();
  readonly created = output<void>();

  readonly lucideAlert = AlertTriangle;
  readonly lucidePlus = Plus;
  readonly lucideTrash = Trash2;

  readonly departments = signal<DepartmentRow[]>([]);
  readonly categories = signal<CategoryRow[]>([]);
  readonly locations = signal<LocationRow[]>([]);
  readonly itemOptions = signal<ItemByLocationSelectRow[]>([]);

  readonly selectedDeptId = signal('');
  readonly selectedCategoryId = signal('');
  readonly sourceLocationId = signal('');
  readonly documentDate = signal<Date>(new Date());
  readonly reason = signal('');
  readonly notes = signal('');
  readonly lines = signal<LineDraft[]>([]);
  readonly searchQuery = signal('');
  readonly selectedItemId = signal('');
  readonly loading = signal(false);
  readonly lookupsLoading = signal(false);
  readonly itemOptionsLoading = signal(false);
  private readonly itemSearch$ = new Subject<string>();

  constructor() {
    effect(() => {
      if (!this.open()) return;
      this.resetForm();
      this.lookupsLoading.set(true);
      this.departmentsApi
        .list({ take: 100, isActive: true })
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (r) => {
            this.departments.set(r.departments);
            this.lookupsLoading.set(false);
          },
          error: () => {
            this.lookupsLoading.set(false);
            this.message.error(this.translate.instant('LOST_ITEMS.CREATE.ERROR_LOOKUPS'));
          },
        });
    });

    this.itemSearch$
      .pipe(
        debounceTime(250),
        distinctUntilChanged(),
        switchMap((query) => {
          const locationId = this.sourceLocationId();
          if (!locationId) {
            this.itemOptionsLoading.set(false);
            return of([] as ItemByLocationSelectRow[]);
          }
          this.itemOptionsLoading.set(true);
          return this.inventoryApi.getItemsByLocationSelect(locationId, { search: query });
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (items) => {
          this.itemOptions.set(items);
          this.itemOptionsLoading.set(false);
        },
        error: () => {
          this.itemOptions.set([]);
          this.itemOptionsLoading.set(false);
          this.message.error(this.translate.instant('LOST_ITEMS.CREATE.ERROR_ITEMS'));
        },
      });
  }

  private resetForm(): void {
    this.selectedDeptId.set('');
    this.selectedCategoryId.set('');
    this.sourceLocationId.set('');
    this.documentDate.set(new Date());
    this.reason.set('');
    this.notes.set('');
    this.lines.set([]);
    this.searchQuery.set('');
    this.selectedItemId.set('');
    this.categories.set([]);
    this.locations.set([]);
    this.itemOptions.set([]);
    this.itemOptionsLoading.set(false);
  }

  onDepartmentChange(id: string): void {
    this.selectedDeptId.set(id);
    this.selectedCategoryId.set('');
    this.sourceLocationId.set('');
    this.itemOptions.set([]);
    this.lines.set([]);
    if (!id) {
      this.categories.set([]);
      this.locations.set([]);
      return;
    }
    this.categoriesApi
      .list({ take: 100, isActive: true, departmentIds: id })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (r) => this.categories.set(r.categories),
        error: () => this.message.error(this.translate.instant('LOST_ITEMS.CREATE.ERROR_CATEGORIES')),
      });
    this.reloadLocations();
  }

  onCategoryChange(id: string): void {
    this.selectedCategoryId.set(id);
    this.sourceLocationId.set('');
    this.itemOptions.set([]);
    this.lines.set([]);
    this.reloadLocations();
  }

  private reloadLocations(): void {
    const deptId = this.selectedDeptId();
    if (!deptId) {
      this.locations.set([]);
      return;
    }
    const catId = this.selectedCategoryId();
    this.locationsApi
      .list({ take: 100, isActive: true, departmentId: deptId, ...(catId ? { categoryId: catId } : {}) })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (r) => {
          this.locations.set(r.locations);
          this.sourceLocationId.set('');
        },
        error: () => this.message.error(this.translate.instant('LOST_ITEMS.CREATE.ERROR_LOCATIONS')),
      });
  }

  onLocationChange(id: string): void {
    this.sourceLocationId.set(id);
    this.selectedItemId.set('');
    this.searchQuery.set('');
    this.itemOptions.set([]);
    this.lines.set([]);
    if (!id) {
      this.itemOptionsLoading.set(false);
      return;
    }
    this.itemSearch$.next('');
  }

  onClose(): void {
    this.closed.emit();
  }

  setDocumentDate(d: Date | null): void {
    this.documentDate.set(d ?? new Date());
  }

  onItemSearch(value: string): void {
    const query = value.trim();
    this.searchQuery.set(query);
    this.itemSearch$.next(query);
  }

  filteredPickItems(): ItemByLocationSelectRow[] {
    const lineIds = new Set(this.lines().map((l) => l.itemId));
    return this.itemOptions().filter((item) => !lineIds.has(item.id));
  }

  onItemPicked(itemId: string | null): void {
    const pickedId = itemId ?? '';
    this.selectedItemId.set(pickedId);
    if (!pickedId) {
      return;
    }
    const item = this.itemOptions().find((x) => x.id === pickedId);
    if (!item) {
      return;
    }
    this.addLine(item);
    this.selectedItemId.set('');
    this.searchQuery.set('');
    this.itemSearch$.next('');
  }

  addLine(item: {
    id: string;
    name: string;
    barcode?: string | null;
    currentStock?: number | null;
  }): void {
    const availableQty = Number(item.currentStock ?? 0);
    if (availableQty <= 0) {
      this.message.warning(
        this.translate.instant('LOST_ITEMS.CREATE.ERROR_ZERO_AVAILABLE', { item: item.name }),
      );
      return;
    }
    this.lines.update((rows) => [
      ...rows,
      { itemId: item.id, name: item.name, barcode: item.barcode, availableQty, qty: 1, notes: '' },
    ]);
  }

  removeLine(index: number): void {
    this.lines.update((rows) => rows.filter((_, i) => i !== index));
  }

  updateLineQty(index: number, qty: number | null): void {
    const row = this.lines()[index];
    if (!row) {
      return;
    }
    const minQty = 1;
    const requested = qty == null || qty <= 0 ? minQty : qty;
    const clamped = Math.min(requested, row.availableQty);
    if (requested > row.availableQty) {
      this.message.warning(
        this.translate.instant('LOST_ITEMS.CREATE.ERROR_QTY_EXCEEDS', {
          item: row.name,
          available: row.availableQty,
        }),
      );
    }
    this.lines.update((rows) => {
      const next = [...rows];
      if (next[index]) next[index] = { ...next[index], qty: clamped };
      return next;
    });
  }

  updateLineNotes(index: number, notes: string): void {
    this.lines.update((rows) => {
      const next = [...rows];
      if (next[index]) next[index] = { ...next[index], notes };
      return next;
    });
  }

  submit(): void {
    const loc = this.sourceLocationId();
    const r = this.reason().trim();
    const rows = this.lines();
    if (!loc || !r || rows.length === 0) {
      this.message.warning(this.translate.instant('LOST_ITEMS.CREATE.VALIDATION'));
      return;
    }
    const exceeded = rows.find((line) => line.qty > line.availableQty);
    if (exceeded) {
      this.message.warning(
        this.translate.instant('LOST_ITEMS.CREATE.ERROR_QTY_EXCEEDS', {
          item: exceeded.name,
          available: exceeded.availableQty,
        }),
      );
      return;
    }
    this.loading.set(true);
    const docDate = this.documentDate().toISOString().slice(0, 10);
    this.lostApi
      .create({
        sourceLocationId: loc,
        reason: r,
        notes: this.notes().trim() || null,
        documentDate: docDate,
        lines: rows.map((l) => ({ itemId: l.itemId, qty: l.qty, notes: l.notes.trim() || null })),
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (doc) => {
          this.loading.set(false);
          const isAutoApproved = doc.status === 'DEPT_APPROVED';
          this.message.success(
            this.translate.instant(
              isAutoApproved
                ? 'LOST_ITEMS.CREATE.AUTO_APPROVED_SUCCESS'
                : 'LOST_ITEMS.CREATE.DRAFT_SUCCESS',
            ),
          );
          this.created.emit();
        },
        error: (e: Error) => {
          this.loading.set(false);
          this.message.error(e.message || this.translate.instant('LOST_ITEMS.CREATE.ERROR'));
        },
      });
  }
}
