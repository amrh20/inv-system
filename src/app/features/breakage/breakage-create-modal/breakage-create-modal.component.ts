import {
  Component,
  DestroyRef,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { of } from 'rxjs';
import { switchMap } from 'rxjs/operators';
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
import { AlertTriangle, Camera, Plus, Search, Trash2, XCircle } from 'lucide-angular';
import type { CategoryRow } from '../../master-data/models/category.model';
import type { DepartmentRow } from '../../master-data/models/department.model';
import type { LocationRow } from '../../master-data/models/location.model';
import type { StockBalanceRow } from '../../stock/models/stock-balance.model';
import { CategoriesService } from '../../master-data/services/categories.service';
import { DepartmentsService } from '../../master-data/services/departments.service';
import { LocationsService } from '../../master-data/services/locations.service';
import { StockService } from '../../stock/services/stock.service';
import { BreakageService } from '../services/breakage.service';

interface LineDraft {
  itemId: string;
  name: string;
  barcode?: string | null;
  qty: number;
  notes: string;
}

@Component({
  selector: 'app-breakage-create-modal',
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
  templateUrl: './breakage-create-modal.component.html',
  styleUrl: './breakage-create-modal.component.scss',
})
export class BreakageCreateModalComponent {
  private readonly departmentsApi = inject(DepartmentsService);
  private readonly categoriesApi = inject(CategoriesService);
  private readonly locationsApi = inject(LocationsService);
  private readonly stockApi = inject(StockService);
  private readonly breakageApi = inject(BreakageService);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);

  readonly open = input.required<boolean>();
  readonly closed = output<void>();
  readonly created = output<string>();

  readonly lucideAlert = AlertTriangle;
  readonly lucidePlus = Plus;
  readonly lucideTrash = Trash2;
  readonly lucideSearch = Search;
  readonly lucideCamera = Camera;
  readonly lucideXCircle = XCircle;

  readonly departments = signal<DepartmentRow[]>([]);
  readonly categories = signal<CategoryRow[]>([]);
  readonly locations = signal<LocationRow[]>([]);
  readonly stockRows = signal<StockBalanceRow[]>([]);

  readonly selectedDeptId = signal('');
  readonly selectedCategoryId = signal('');
  readonly sourceLocationId = signal('');
  readonly documentDate = signal<Date>(new Date());
  readonly reason = signal('');
  readonly notes = signal('');
  readonly lines = signal<LineDraft[]>([]);
  readonly searchQuery = signal('');
  readonly searchOpen = signal(false);
  readonly photos = signal<File[]>([]);

  readonly loading = signal(false);
  readonly lookupsLoading = signal(false);

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
            this.message.error(this.translate.instant('BREAKAGE.CREATE.ERROR_LOOKUPS'));
            this.lookupsLoading.set(false);
          },
        });
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
    this.searchOpen.set(false);
    this.photos.set([]);
    this.categories.set([]);
    this.locations.set([]);
    this.stockRows.set([]);
  }

  onDepartmentChange(id: string): void {
    this.selectedDeptId.set(id);
    this.selectedCategoryId.set('');
    this.sourceLocationId.set('');
    this.stockRows.set([]);
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
        error: () => this.message.error(this.translate.instant('BREAKAGE.CREATE.ERROR_CATEGORIES')),
      });
    this.reloadLocations();
  }

  onCategoryChange(id: string): void {
    this.selectedCategoryId.set(id);
    this.sourceLocationId.set('');
    this.stockRows.set([]);
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
      .list({
        take: 100,
        isActive: true,
        departmentId: deptId,
        ...(catId ? { categoryId: catId } : {}),
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (r) => {
          this.locations.set(r.locations);
          this.sourceLocationId.set('');
        },
        error: () => this.message.error(this.translate.instant('BREAKAGE.CREATE.ERROR_LOCATIONS')),
      });
  }

  onLocationChange(id: string): void {
    this.sourceLocationId.set(id);
    const catId = this.selectedCategoryId();
    if (!id) {
      this.stockRows.set([]);
      return;
    }
    this.stockApi
      .getStockBalances({
        locationId: id,
        take: 500,
        showZero: 'true',
        ...(catId ? { categoryId: catId } : {}),
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (r) => this.stockRows.set(r.balances),
        error: () => this.message.error(this.translate.instant('BREAKAGE.CREATE.ERROR_STOCK')),
      });
  }

  onClose(): void {
    this.closed.emit();
  }

  setDocumentDate(d: Date | null): void {
    this.documentDate.set(d ?? new Date());
  }

  onSearchBlur(): void {
    setTimeout(() => this.searchOpen.set(false), 200);
  }

  uniqueItems(): Array<{ id: string; name: string; barcode?: string | null; qtyOnHand: number }> {
    const map = new Map<string, { id: string; name: string; barcode?: string | null; qtyOnHand: number }>();
    for (const b of this.stockRows()) {
      if (!b.item) continue;
      if (!map.has(b.itemId)) {
        map.set(b.itemId, {
          id: b.itemId,
          name: b.item.name,
          barcode: b.item.barcode,
          qtyOnHand: Number(b.qtyOnHand),
        });
      }
    }
    return [...map.values()];
  }

  filteredPickItems(): Array<{ id: string; name: string; barcode?: string | null; qtyOnHand: number }> {
    const q = this.searchQuery().trim().toLowerCase();
    const lineIds = new Set(this.lines().map((l) => l.itemId));
    return this
      .uniqueItems()
      .filter(
        (i) =>
          !lineIds.has(i.id) &&
          (!q ||
            i.name.toLowerCase().includes(q) ||
            (i.barcode && i.barcode.toLowerCase().includes(q))),
      )
      .slice(0, q ? 5 : 8);
  }

  addLine(item: { id: string; name: string; barcode?: string | null }): void {
    this.lines.update((rows) => [
      ...rows,
      { itemId: item.id, name: item.name, barcode: item.barcode, qty: 1, notes: '' },
    ]);
    this.searchQuery.set('');
    this.searchOpen.set(false);
  }

  removeLine(index: number): void {
    this.lines.update((rows) => rows.filter((_, i) => i !== index));
  }

  updateLineQty(index: number, qty: number | null): void {
    const v = qty == null || qty <= 0 ? 1 : qty;
    this.lines.update((rows) => {
      const next = [...rows];
      if (next[index]) next[index] = { ...next[index], qty: v };
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

  onPhotoPick(e: Event): void {
    const input = e.target as HTMLInputElement;
    const files = input.files ? Array.from(input.files) : [];
    input.value = '';
    if (!files.length) return;
    this.photos.update((prev) => [...prev, ...files].slice(0, 6));
  }

  removePhoto(index: number): void {
    this.photos.update((p) => p.filter((_, i) => i !== index));
  }

  submit(): void {
    const loc = this.sourceLocationId();
    const r = this.reason().trim();
    const rows = this.lines();
    if (!loc || !r || rows.length === 0) {
      this.message.warning(this.translate.instant('BREAKAGE.CREATE.VALIDATION'));
      return;
    }
    this.loading.set(true);
    const docDate =
      this.documentDate() instanceof Date
        ? this.documentDate().toISOString().slice(0, 10)
        : String(this.documentDate());
    this.breakageApi
      .create({
        sourceLocationId: loc,
        reason: r,
        notes: this.notes().trim() || null,
        documentDate: docDate,
        lines: rows.map((l) => ({
          itemId: l.itemId,
          qty: l.qty,
          notes: l.notes.trim() || null,
        })),
      })
      .pipe(
        switchMap((doc) => {
          const files = this.photos();
          if (!files.length) return of(doc);
          let chain = of(doc);
          for (const f of files) {
            chain = chain.pipe(switchMap((d) => this.breakageApi.uploadAttachment(d.id, f)));
          }
          return chain;
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (doc) => {
          this.loading.set(false);
          this.message.success(this.translate.instant('BREAKAGE.CREATE.SUCCESS'));
          this.created.emit(doc.id);
        },
        error: (err: Error) => {
          this.loading.set(false);
          this.message.error(err.message || this.translate.instant('BREAKAGE.CREATE.ERROR'));
        },
      });
  }
}
