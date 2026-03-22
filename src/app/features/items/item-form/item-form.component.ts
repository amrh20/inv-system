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
import {
  FormArray,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { forkJoin, lastValueFrom, of } from 'rxjs';
import { catchError, first, switchMap, tap } from 'rxjs/operators';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzGridModule } from 'ng-zorro-antd/grid';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { LucideAngularModule } from 'lucide-angular';
import { AlertCircle, ImageIcon, Loader2, Package, Ruler, Save, X } from 'lucide-angular';
import { CategoriesService } from '../services/categories.service';
import { ItemMasterLookupsService } from '../services/item-master-lookups.service';
import { ItemsService } from '../services/items.service';
import { UnitsService } from '../services/units.service';
import type {
  CategoryOption,
  DepartmentOption,
  ItemDetail,
  ItemListRow,
  ItemPayload,
  ItemUnitRow,
  LocationOption,
  SubcategoryOption,
  SupplierOption,
  UnitOption,
} from '../models/item.model';

@Component({
  selector: 'app-item-form',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    NzModalModule,
    NzTabsModule,
    NzFormModule,
    NzInputModule,
    NzInputNumberModule,
    NzSelectModule,
    NzButtonModule,
    NzCheckboxModule,
    NzGridModule,
    NzSpinModule,
    LucideAngularModule,
    TranslatePipe,
  ],
  templateUrl: './item-form.component.html',
  styleUrl: './item-form.component.scss',
})
export class ItemFormComponent {
  private readonly fb = inject(FormBuilder);
  private readonly itemsApi = inject(ItemsService);
  private readonly categoriesApi = inject(CategoriesService);
  private readonly unitsApi = inject(UnitsService);
  private readonly lookups = inject(ItemMasterLookupsService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly translate = inject(TranslateService);

  /** Item to edit; omit or null for create. */
  readonly item = input<ItemListRow | ItemDetail | null>(null);
  readonly visible = input(false);
  readonly closed = output<void>();
  readonly saved = output<void>();

  readonly lucideX = X;
  readonly lucidePackage = Package;
  readonly lucideImage = ImageIcon;
  readonly lucideRuler = Ruler;
  readonly lucideSave = Save;
  readonly lucideLoader = Loader2;
  readonly lucideAlert = AlertCircle;

  readonly loadingLookups = signal(true);
  readonly saving = signal(false);
  readonly submitError = signal('');
  readonly activeTab = signal(0);
  readonly imagePreview = signal<string | null>(null);
  readonly imageFile = signal<File | null>(null);
  readonly removeImage = signal(false);

  categories = signal<CategoryOption[]>([]);
  subcategories = signal<SubcategoryOption[]>([]);
  units = signal<UnitOption[]>([]);
  suppliers = signal<SupplierOption[]>([]);
  departments = signal<{ id: string; name: string }[]>([]);
  locations = signal<LocationOption[]>([]);

  readonly form: FormGroup = this.fb.group({
    name: ['', [Validators.required, Validators.maxLength(255)]],
    barcode: [''],
    description: [''],
    departmentId: ['', Validators.required],
    categoryId: [''],
    subcategoryId: [''],
    supplierId: [''],
    defaultStoreId: ['', Validators.required],
    unitPrice: [null as number | null, [Validators.min(0)]],
    reorderPoint: [null as number | null, [Validators.min(0)]],
    reorderQty: [null as number | null, [Validators.min(0)]],
    isActive: [true],
    itemUnits: this.fb.array<FormGroup>([]),
  });

  constructor() {
    effect(() => {
      if (!this.visible()) {
        return;
      }
      this.submitError.set('');
      this.activeTab.set(0);
      this.imageFile.set(null);
      this.removeImage.set(false);
      const row = this.item();
      if (row) {
        this.patchForEdit(row);
      } else {
        this.resetForCreate();
      }
    });

    this.form
      .get('categoryId')
      ?.valueChanges.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((catId: string) => {
        this.form.get('subcategoryId')?.setValue('', { emitEvent: false });
        const cat = this.categories().find((c) => c.id === catId);
        this.subcategories.set(cat?.subcategories ?? []);
      });

    this.form
      .get('departmentId')
      ?.valueChanges.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.form.get('defaultStoreId')?.setValue('', { emitEvent: false });
      });
  }

  get itemUnits(): FormArray<FormGroup> {
    return this.form.get('itemUnits') as FormArray<FormGroup>;
  }

  filteredStores(): LocationOption[] {
    const deptId = this.form.get('departmentId')?.value as string;
    const all = this.locations();
    if (!deptId) {
      return all;
    }
    return all.filter((l) => !l.departmentId || l.departmentId === deptId);
  }

  addUnitRow(): void {
    this.itemUnits.push(
      this.fb.group({
        unitId: ['', Validators.required],
        unitType: ['BASE' as ItemUnitRow['unitType']],
        conversionRate: [1, [Validators.required, Validators.min(0.000001)]],
      }),
    );
  }

  removeUnitRow(index: number): void {
    this.itemUnits.removeAt(index);
  }

  onImagePicked(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      return;
    }
    this.imageFile.set(file);
    this.removeImage.set(false);
    this.imagePreview.set(URL.createObjectURL(file));
    input.value = '';
  }

  clearImage(): void {
    this.imageFile.set(null);
    this.imagePreview.set(null);
    this.removeImage.set(true);
  }

  close(): void {
    this.closed.emit();
  }

  onTabIndexChange(index: number): void {
    this.activeTab.set(index);
  }

  save(): void {
    this.submitError.set('');
    if (this.form.invalid) {
      Object.values(this.form.controls).forEach((c) => {
        c.markAsDirty();
        c.updateValueAndValidity({ onlySelf: true });
      });
      this.itemUnits.controls.forEach((g) => {
        g.markAllAsDirty();
        g.updateValueAndValidity();
      });
      return;
    }

    const raw = this.form.getRawValue();
    const itemUnits: ItemUnitRow[] = this.itemUnits.controls.map((g) => ({
      unitId: g.get('unitId')?.value,
      unitType: g.get('unitType')?.value,
      conversionRate: Number(g.get('conversionRate')?.value),
    }));

    const baseCount = itemUnits.filter((u) => u.unitType === 'BASE').length;
    if (baseCount > 1) {
      this.submitError.set(this.t('ITEM_FORM.ERROR_ONLY_ONE_BASE_UNIT'));
      return;
    }
    for (const u of itemUnits) {
      if (!u.unitId) {
        this.submitError.set(this.t('ITEM_FORM.ERROR_SELECT_UNIT_ALL_ROWS'));
        return;
      }
      if (Number.isNaN(u.conversionRate) || u.conversionRate <= 0) {
        this.submitError.set(this.t('ITEM_FORM.ERROR_POSITIVE_CONVERSION'));
        return;
      }
    }

    const payload: ItemPayload = {
      name: (raw.name as string).trim(),
      barcode: (raw.barcode as string) || undefined,
      description: (raw.description as string) || undefined,
      departmentId: raw.departmentId || null,
      categoryId: raw.categoryId || null,
      subcategoryId: raw.subcategoryId || null,
      supplierId: raw.supplierId || null,
      defaultStoreId: raw.defaultStoreId || null,
      unitPrice: raw.unitPrice != null && raw.unitPrice !== '' ? Number(raw.unitPrice) : 0,
      reorderPoint: raw.reorderPoint != null ? Number(raw.reorderPoint) : 0,
      reorderQty: raw.reorderQty != null ? Number(raw.reorderQty) : 0,
      isActive: raw.isActive !== false,
      itemUnits: itemUnits.length ? itemUnits : undefined,
    };

    if (this.removeImage() && !this.imageFile()) {
      payload.imageUrl = null;
    }

    const current = this.item();
    this.saving.set(true);

    const req$ = current
      ? this.itemsApi.updateItem(current.id, payload)
      : this.itemsApi.createItem(payload);

    req$.pipe(first()).subscribe({
      next: async (saved) => {
        const file = this.imageFile();
        if (file && saved?.id) {
          try {
            await lastValueFrom(this.itemsApi.uploadImage(saved.id, file));
          } catch (e: unknown) {
            const msg =
              e && typeof e === 'object' && 'message' in e
                ? String((e as Error).message)
                : this.t('ITEM_FORM.ERROR_IMAGE_UPLOAD');
            this.submitError.set(msg);
            this.saving.set(false);
            return;
          }
        }
        this.saving.set(false);
        this.saved.emit();
      },
      error: (err: { error?: { message?: string }; message?: string }) => {
        this.saving.set(false);
        this.submitError.set(err?.error?.message ?? err?.message ?? this.t('ITEM_FORM.ERROR_SAVE'));
      },
    });
  }

  private resetForCreate(): void {
    this.form.reset({
      name: '',
      barcode: '',
      description: '',
      departmentId: '',
      categoryId: '',
      subcategoryId: '',
      supplierId: '',
      defaultStoreId: '',
      unitPrice: null,
      reorderPoint: null,
      reorderQty: null,
      isActive: true,
    });
    this.clearItemUnits();
    this.imagePreview.set(null);
    this.loadingLookups.set(true);
    this.fetchLookups$()
      .pipe(first())
      .subscribe({
        next: () => this.loadingLookups.set(false),
        error: () => this.loadingLookups.set(false),
      });
  }

  private patchForEdit(row: ItemListRow | ItemDetail): void {
    this.loadingLookups.set(true);
    this.fetchLookups$()
      .pipe(
        first(),
        switchMap(() =>
          this.itemsApi.getItemById(row.id).pipe(catchError(() => of(null as ItemDetail | null))),
        ),
      )
      .subscribe((detail) => {
        this.loadingLookups.set(false);
        if (!detail) {
          this.form.patchValue({
            name: row.name,
            barcode: row.barcode ?? '',
            description: row.description ?? '',
            isActive: row.isActive,
            unitPrice: row.unitPrice != null ? Number(row.unitPrice) : null,
          });
          this.imagePreview.set(this.itemsApi.resolveAssetUrl(row.imageUrl));
          return;
        }
        this.form.patchValue({
          name: detail.name,
          barcode: detail.barcode ?? '',
          description: detail.description ?? '',
          departmentId: detail.departmentId ?? '',
          categoryId: detail.categoryId ?? '',
          subcategoryId: detail.subcategoryId ?? '',
          supplierId: detail.supplierId ?? '',
          defaultStoreId: detail.defaultStoreId ?? '',
          unitPrice: detail.unitPrice != null ? Number(detail.unitPrice) : null,
          reorderPoint: detail.reorderPoint ?? null,
          reorderQty: detail.reorderQty ?? null,
          isActive: detail.isActive !== false,
        });
        const cat = this.categories().find((c) => c.id === (detail.categoryId ?? ''));
        this.subcategories.set(cat?.subcategories ?? []);
        this.imagePreview.set(this.itemsApi.resolveAssetUrl(detail.imageUrl));
        this.removeImage.set(false);
        this.imageFile.set(null);
        this.clearItemUnits();
        this.itemsApi
          .getItemUnits(row.id)
          .pipe(first())
          .subscribe((units) => {
            for (const u of units) {
              this.itemUnits.push(
                this.fb.group({
                  unitId: [u.unitId, Validators.required],
                  unitType: [u.unitType],
                  conversionRate: [
                    Number(u.conversionRate),
                    [Validators.required, Validators.min(0.000001)],
                  ],
                }),
              );
            }
          });
      });
  }

  private clearItemUnits(): void {
    while (this.itemUnits.length) {
      this.itemUnits.removeAt(0);
    }
  }

  private fetchLookups$() {
    return forkJoin({
      categories: this.categoriesApi
        .list({ take: 200, isActive: true })
        .pipe(catchError(() => of([] as CategoryOption[]))),
      units: this.unitsApi
        .list({ take: 200, isActive: true })
        .pipe(catchError(() => of([] as UnitOption[]))),
      suppliers: this.lookups
        .listSuppliers({ take: 200, isActive: true })
        .pipe(catchError(() => of([] as SupplierOption[]))),
      departments: this.lookups
        .listDepartments({ take: 200, isActive: true })
        .pipe(catchError(() => of([] as DepartmentOption[]))),
      locations: this.lookups
        .listLocations({ take: 200, isActive: true })
        .pipe(catchError(() => of([] as LocationOption[]))),
    }).pipe(
      tap((res) => {
        this.categories.set(res.categories);
        this.units.set(res.units);
        this.suppliers.set(res.suppliers);
        this.departments.set(res.departments);
        this.locations.set(res.locations);
      }),
    );
  }

  private t(key: string, params?: Record<string, unknown>): string {
    return this.translate.instant(key, params);
  }
}
