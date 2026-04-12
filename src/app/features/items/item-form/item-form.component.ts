import {
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { forkJoin, lastValueFrom, merge, of, type Observable } from 'rxjs';
import { catchError, distinctUntilChanged, filter, finalize, first, map, startWith, switchMap, tap } from 'rxjs/operators';
import { ConfirmationService } from '../../../core/services/confirmation.service';
import type { MovementDocumentPayload } from '../../movements/models/movement-document.model';
import { MovementDocumentsService } from '../../movements/services/movement-documents.service';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzGridModule } from 'ng-zorro-antd/grid';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzDividerModule } from 'ng-zorro-antd/divider';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { LucideAngularModule } from 'lucide-angular';
import { AlertCircle, ArrowLeft, ImageIcon, Loader2, Package, Save } from 'lucide-angular';
import { CategoriesService } from '../services/categories.service';
import { ItemMasterLookupsService } from '../services/item-master-lookups.service';
import { ItemsService } from '../services/items.service';
import { UnitsService } from '../services/units.service';
import {
  getMissingItemCreationRequirements,
  type CategoryOption,
  type ItemDetail,
  type ItemListRow,
  type ItemPayload,
  type ItemUnitRow,
  type LocationOption,
  type RequirementsResponse,
  type SubcategoryOption,
  type SupplierOption,
  type UnitOption,
} from '../models/item.model';

/** When opening quantity is positive, opening unit cost is required (re-validated when quantity changes). */
function openingStockCostWhenQtyValidator(control: AbstractControl): ValidationErrors | null {
  const parent = control.parent;
  if (!parent) {
    return null;
  }
  const qtyRaw = parent.get('openingQty')?.value;
  const qtyNum = qtyRaw != null && qtyRaw !== '' ? Number(qtyRaw) : 0;
  if (Number.isNaN(qtyNum) || qtyNum <= 0) {
    return null;
  }
  const v = control.value;
  if (v == null || v === '' || (typeof v === 'string' && String(v).trim() === '')) {
    return { openingStockCostRequired: true };
  }
  const num = Number(v);
  if (Number.isNaN(num)) {
    return { openingStockCostRequired: true };
  }
  if (num < 0) {
    return { min: true };
  }
  return null;
}

@Component({
  selector: 'app-item-form',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    NzDividerModule,
    NzFormModule,
    NzInputModule,
    NzInputNumberModule,
    NzSelectModule,
    NzButtonModule,
    NzCheckboxModule,
    NzGridModule,
    NzSpinModule,
    NzAlertModule,
    LucideAngularModule,
    TranslatePipe,
  ],
  providers: [ConfirmationService],
  templateUrl: './item-form.component.html',
  styleUrl: './item-form.component.scss',
})
export class ItemFormComponent {
  /** Incremented on each route-driven reload so stale HTTP callbacks are ignored. */
  private dataLoadGen = 0;

  private readonly fb = inject(FormBuilder);
  private readonly itemsApi = inject(ItemsService);
  private readonly categoriesApi = inject(CategoriesService);
  private readonly unitsApi = inject(UnitsService);
  private readonly lookups = inject(ItemMasterLookupsService);
  private readonly movementDocsApi = inject(MovementDocumentsService);
  private readonly confirmation = inject(ConfirmationService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly translate = inject(TranslateService);
  private readonly router = inject(Router);
  private readonly message = inject(NzMessageService);

  /**
   * Item id for `/items/:id/edit`. Derived from the router URL so it stays in sync with
   * `GET ${apiUrl}/items/:id` (same id segment as in the API path).
   */
  readonly editItemId = toSignal(
    merge(
      of(null).pipe(map(() => this.parseEditItemIdFromUrl())),
      this.router.events.pipe(
        filter((e): e is NavigationEnd => e instanceof NavigationEnd),
        map(() => this.parseEditItemIdFromUrl()),
      ),
    ).pipe(distinctUntilChanged()),
    { initialValue: this.parseEditItemIdFromUrl() },
  );

  readonly lucideArrowLeft = ArrowLeft;
  readonly lucidePackage = Package;
  readonly lucideImage = ImageIcon;
  readonly lucideSave = Save;
  readonly lucideLoader = Loader2;
  readonly lucideAlert = AlertCircle;

  readonly loadingLookups = signal(true);
  readonly saving = signal(false);
  readonly submitError = signal('');
  readonly imagePreview = signal<string | null>(null);
  readonly imageFile = signal<File | null>(null);
  readonly removeImage = signal(false);

  /** PURCHASE / ISSUE rows from the API; merged back on save so they are not dropped. */
  readonly extraItemUnitsSnapshot = signal<ItemUnitRow[]>([]);

  categories = signal<CategoryOption[]>([]);
  readonly subcategories = signal<SubcategoryOption[]>([]);
  readonly subcategoriesLoading = signal(false);
  units = signal<UnitOption[]>([]);
  suppliers = signal<SupplierOption[]>([]);
  departments = signal<{ id: string; name: string }[]>([]);
  locations = signal<LocationOption[]>([]);
  readonly requirements = signal<RequirementsResponse | null>(null);

  readonly isEditMode = computed(() => this.editItemId() != null && this.editItemId() !== '');

  readonly showOpeningBalanceFields = computed(() => {
    if (this.isEditMode()) {
      return false;
    }
    const req = this.requirements();
    if (!req) {
      return false;
    }
    if (req.isOpeningBalanceAllowed !== true) {
      return false;
    }
    return req.canCreateItem === true;
  });

  readonly showItemFormPrerequisitesBanner = computed(() => {
    const req = this.requirements();
    if (this.isEditMode() || !req || this.loadingLookups() || req.canCreateItem) {
      return false;
    }
    return true;
  });

  /** Matches Item Master: OB setup-phase notice; hidden after finalize. */
  readonly showItemFormOpeningBalanceSetupBanner = computed(() => {
    const req = this.requirements();
    if (this.isEditMode() || !req || this.loadingLookups() || !req.canCreateItem) {
      return false;
    }
    return req.isOpeningBalanceAllowed === true;
  });

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
    openingQty: [null as number | null],
    openingCost: [null as number | null],
    isActive: [true],
    baseUnitId: ['', Validators.required],
  });

  /** Matches `/items/<uuid>/edit` → id used with `ItemsService.getItemById(id)`. */
  private parseEditItemIdFromUrl(): string | null {
    const path = this.router.url.split('?')[0];
    const m = /^\/items\/([^/]+)\/edit\/?$/.exec(path);
    return m ? decodeURIComponent(m[1]) : null;
  }

  constructor() {
    effect(() => {
      const id = this.editItemId();
      const gen = ++this.dataLoadGen;
      this.submitError.set('');
      this.imageFile.set(null);
      this.removeImage.set(false);
      this.extraItemUnitsSnapshot.set([]);
      if (id) {
        this.patchForEdit({ id } as ItemListRow, gen);
      } else {
        this.resetForCreate(gen);
      }
    });

    effect(() => {
      if (this.isEditMode()) {
        this.syncOpeningBalanceValidators(false);
        return;
      }
      this.syncOpeningBalanceValidators(this.showOpeningBalanceFields());
    });

    effect(() => {
      const supplier = this.form.get('supplierId');
      if (!supplier) {
        return;
      }
      if (this.isEditMode()) {
        supplier.clearValidators();
      } else {
        supplier.setValidators([Validators.required]);
      }
      supplier.updateValueAndValidity({ emitEvent: false });
    });

    this.form
      .get('categoryId')
      ?.valueChanges.pipe(
        takeUntilDestroyed(this.destroyRef),
        switchMap((catId: string | null) =>
          this.loadSubcategoriesForCategoryId$(catId, { clearSubcategory: true }),
        ),
      )
      .subscribe();

    this.form
      .get('departmentId')
      ?.valueChanges.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.form.get('defaultStoreId')?.setValue('', { emitEvent: false });
      });

    this.form
      .get('openingQty')
      ?.valueChanges.pipe(startWith(this.form.get('openingQty')?.value), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        if (this.showOpeningBalanceFields()) {
          this.form.get('openingCost')?.updateValueAndValidity({ emitEvent: false });
        }
      });
  }

  filteredStores(): LocationOption[] {
    const deptId = this.form.get('departmentId')?.value as string;
    const all = this.locations();
    if (!deptId) {
      return all;
    }
    return all.filter((l) => !l.departmentId || l.departmentId === deptId);
  }

  isSubcategorySelectDisabled(): boolean {
    const catId = this.form.get('categoryId')?.value as string | undefined;
    if (catId == null || String(catId).trim() === '') {
      return true;
    }
    if (this.subcategoriesLoading()) {
      return true;
    }
    return this.subcategories().length === 0;
  }

  private loadSubcategoriesForCategoryId$(
    catId: string | null,
    options: { clearSubcategory: boolean },
  ): Observable<SubcategoryOption[]> {
    if (options.clearSubcategory) {
      this.form.get('subcategoryId')?.setValue('', { emitEvent: false });
    }
    const id = catId == null || String(catId).trim() === '' ? '' : String(catId).trim();
    if (!id) {
      this.subcategories.set([]);
      this.subcategoriesLoading.set(false);
      return of([] as SubcategoryOption[]);
    }
    this.subcategoriesLoading.set(true);
    return this.categoriesApi.listSubcategories(id).pipe(
      tap((subs) => this.subcategories.set(subs)),
      finalize(() => this.subcategoriesLoading.set(false)),
    );
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

  cancel(): void {
    void this.router.navigate(['/items']);
  }

  save(): void {
    this.submitError.set('');
    if (this.form.invalid) {
      Object.values(this.form.controls).forEach((c) => {
        c.markAsDirty();
        c.updateValueAndValidity({ onlySelf: true });
      });
      return;
    }

    const raw = this.form.getRawValue();
    const baseUnitId = (raw.baseUnitId as string) || '';
    if (!baseUnitId.trim()) {
      this.submitError.set(this.t('ITEM_FORM.ERROR_BASE_UNIT_SELECT'));
      return;
    }

    const itemUnits: ItemUnitRow[] = [
      { unitId: baseUnitId.trim(), unitType: 'BASE', conversionRate: 1 },
      ...this.extraItemUnitsSnapshot(),
    ];

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
      isActive: raw.isActive !== false,
      itemUnits,
    };

    if (this.removeImage() && !this.imageFile()) {
      payload.imageUrl = null;
    }

    const currentId = this.editItemId();
    const openingQty =
      raw.openingQty != null && raw.openingQty !== '' ? Number(raw.openingQty) : 0;
    const openingCost =
      raw.openingCost != null && raw.openingCost !== '' ? Number(raw.openingCost) : null;

    if (
      !currentId &&
      this.requirements()?.canCreateItem &&
      this.requirements()?.isOpeningBalanceAllowed &&
      openingQty > 0
    ) {
      if (openingQty < 0 || Number.isNaN(openingQty)) {
        this.submitError.set(this.t('ITEM_FORM.ERROR_OB_QTY_INVALID'));
        return;
      }
      if (!raw.defaultStoreId) {
        this.submitError.set(this.t('ITEM_FORM.ERROR_OB_STORE_REQUIRED'));
        return;
      }
      if (openingCost == null || Number.isNaN(openingCost) || openingCost < 0) {
        this.submitError.set(this.t('ITEM_FORM.ERROR_OPENING_STOCK_COST_REQUIRED'));
        return;
      }
    }

    this.saving.set(true);

    const req$ = currentId
      ? this.itemsApi.updateItem(currentId, payload)
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

        if (
          !currentId &&
          saved?.id &&
          this.requirements()?.canCreateItem &&
          this.requirements()?.isOpeningBalanceAllowed &&
          openingQty > 0 &&
          openingCost != null &&
          !Number.isNaN(openingCost) &&
          openingCost >= 0
        ) {
          const storeId = (raw.defaultStoreId as string) || '';
          if (!storeId) {
            this.submitError.set(this.t('ITEM_FORM.ERROR_OB_STORE_REQUIRED'));
            this.saving.set(false);
            return;
          }
          try {
            const obPayload = this.buildOpeningBalancePayload(
              saved.id,
              storeId,
              openingQty,
              openingCost,
            );
            const doc = await lastValueFrom(this.movementDocsApi.create(obPayload));
            const confirmed = await lastValueFrom(
              this.confirmation
                .confirm({
                  title: this.t('ITEM_FORM.CONFIRM_OB_POST_TITLE'),
                  message: this.t('ITEM_FORM.CONFIRM_OB_POST_MESSAGE'),
                  confirmText: this.t('MOVEMENTS.POST_DOCUMENT'),
                  cancelText: this.t('COMMON.CANCEL'),
                })
                .pipe(first()),
            );
            if (!confirmed) {
              this.submitError.set(this.t('ITEM_FORM.ERROR_OB_POST_CANCELLED'));
              this.saving.set(false);
              return;
            }
            await lastValueFrom(this.movementDocsApi.post(doc.id));
          } catch (e: unknown) {
            const msg =
              e && typeof e === 'object' && 'message' in e
                ? String((e as Error).message)
                : this.t('ITEM_FORM.ERROR_OB_MOVEMENT_FAILED');
            this.submitError.set(msg);
            this.saving.set(false);
            return;
          }
        }

        this.saving.set(false);
        this.message.success(this.t('ITEMS.SUCCESS_SAVED'));
        void this.router.navigate(['/items']);
      },
      error: (err: { error?: { message?: string }; message?: string }) => {
        this.saving.set(false);
        this.submitError.set(err?.error?.message ?? err?.message ?? this.t('ITEM_FORM.ERROR_SAVE'));
      },
    });
  }

  private buildOpeningBalancePayload(
    itemId: string,
    defaultStoreId: string,
    qty: number,
    unitCost: number,
  ): MovementDocumentPayload {
    const qtyRequested = Number(qty);
    const cost = Number(unitCost);
    return {
      movementType: 'OPENING_BALANCE',
      documentDate: new Date().toISOString().split('T')[0],
      sourceLocationId: null,
      destLocationId: defaultStoreId,
      supplierId: null,
      reason: null,
      department: null,
      notes: this.t('ITEM_FORM.OB_MOVEMENT_NOTES'),
      lines: [
        {
          itemId,
          locationId: defaultStoreId,
          qtyRequested,
          unitCost: cost,
          totalValue: qtyRequested * cost,
          notes: null,
        },
      ],
    };
  }

  private resetForCreate(gen: number): void {
    this.requirements.set(null);
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
      openingQty: null,
      openingCost: null,
      isActive: true,
      baseUnitId: '',
    });
    this.imagePreview.set(null);
    this.loadingLookups.set(true);
    forkJoin({
      lookups: this.fetchLookups$(),
      checkRequirements: this.itemsApi.checkRequirements().pipe(
        map((res) => (res.success && res.data ? res.data : null)),
        catchError(() => of(null)),
      ),
    })
      .pipe(first())
      .subscribe({
        next: ({ checkRequirements: reqData }) => {
          if (gen !== this.dataLoadGen) {
            return;
          }
          this.requirements.set(reqData);
          this.loadingLookups.set(false);
        },
        error: () => {
          if (gen !== this.dataLoadGen) {
            return;
          }
          this.loadingLookups.set(false);
          this.requirements.set(null);
        },
      });
  }

  private applyUnitsFromApiRows(units: ItemUnitRow[]): void {
    const base = units.find((u) => u.unitType === 'BASE');
    this.form.patchValue({ baseUnitId: base?.unitId ?? '' }, { emitEvent: false });
    this.extraItemUnitsSnapshot.set(
      units
        .filter((u) => u.unitType !== 'BASE')
        .map((u) => ({
          unitId: u.unitId,
          unitType: u.unitType,
          conversionRate: Number(u.conversionRate),
        })),
    );
    this.form.get('baseUnitId')?.updateValueAndValidity({ emitEvent: false });
  }

  private patchBaseUnitFromListRow(row: ItemListRow): void {
    const base = row.itemUnits?.find((u) => u.unitType === 'BASE');
    const id = base?.unit?.id ?? '';
    this.form.patchValue({ baseUnitId: id }, { emitEvent: false });
    this.extraItemUnitsSnapshot.set([]);
    this.form.get('baseUnitId')?.updateValueAndValidity({ emitEvent: false });
  }

  private patchForEdit(row: ItemListRow, gen: number): void {
    this.requirements.set(null);
    this.loadingLookups.set(true);
    this.form.reset(
      {
        name: '',
        barcode: '',
        description: '',
        departmentId: '',
        categoryId: '',
        subcategoryId: '',
        supplierId: '',
        defaultStoreId: '',
        unitPrice: null,
        openingQty: null,
        openingCost: null,
        isActive: true,
        baseUnitId: '',
      },
      { emitEvent: false },
    );
    this.fetchLookups$()
      .pipe(
        first(),
        switchMap(() =>
          this.itemsApi.getItemById(row.id).pipe(catchError(() => of(null as ItemDetail | null))),
        ),
      )
      .subscribe((detail) => {
        if (gen !== this.dataLoadGen) {
          return;
        }
        const itemRow = row;
        this.loadingLookups.set(false);
        if (!detail) {
          this.message.warning(this.t('ITEM_FORM.ERROR_LOAD_DETAIL'));
          this.subcategories.set([]);
          this.subcategoriesLoading.set(false);
          this.form.patchValue(
            {
              name: itemRow.name,
              barcode: itemRow.barcode ?? '',
              description: itemRow.description ?? '',
              isActive: itemRow.isActive,
              unitPrice: itemRow.unitPrice != null ? Number(itemRow.unitPrice) : null,
              openingQty: null,
              openingCost: null,
            },
            { emitEvent: false },
          );
          this.imagePreview.set(this.itemsApi.resolveAssetUrl(itemRow.imageUrl));
          this.removeImage.set(false);
          this.imageFile.set(null);
          this.patchBaseUnitFromListRow(itemRow);
          this.itemsApi
            .getItemUnits(itemRow.id)
            .pipe(first())
            .subscribe((units) => {
              if (gen !== this.dataLoadGen) {
                return;
              }
              if (units.length) {
                this.applyUnitsFromApiRows(units);
              }
            });
          return;
        }
        this.form.patchValue(
          {
            name: detail.name,
            barcode: detail.barcode ?? '',
            description: detail.description ?? '',
            departmentId: detail.departmentId ?? '',
            categoryId: detail.categoryId ?? '',
            subcategoryId: detail.subcategoryId ?? '',
            supplierId: detail.supplierId ?? '',
            defaultStoreId: detail.defaultStoreId ?? '',
            unitPrice: detail.unitPrice != null ? Number(detail.unitPrice) : null,
            openingQty: null,
            openingCost: null,
            isActive: detail.isActive !== false,
            baseUnitId: '',
          },
          { emitEvent: false },
        );
        this.loadSubcategoriesForCategoryId$(detail.categoryId ?? '', {
          clearSubcategory: false,
        })
          .pipe(first())
          .subscribe();
        this.imagePreview.set(this.itemsApi.resolveAssetUrl(detail.imageUrl));
        this.removeImage.set(false);
        this.imageFile.set(null);
        this.itemsApi
          .getItemUnits(itemRow.id)
          .pipe(first())
          .subscribe((units) => {
            if (gen !== this.dataLoadGen) {
              return;
            }
            this.applyUnitsFromApiRows(units);
            if (!units.length) {
              this.patchBaseUnitFromListRow(itemRow);
            }
          });
      });
  }

  private syncOpeningBalanceValidators(showOb: boolean): void {
    const openingQty = this.form.get('openingQty');
    const openingCost = this.form.get('openingCost');
    if (!openingQty || !openingCost) {
      return;
    }
    if (showOb) {
      openingQty.setValidators([Validators.min(0)]);
      openingCost.setValidators([openingStockCostWhenQtyValidator, Validators.min(0)]);
    } else {
      openingQty.clearValidators();
      openingCost.clearValidators();
    }
    openingQty.updateValueAndValidity({ emitEvent: false });
    openingCost.updateValueAndValidity({ emitEvent: false });
  }


  missingRequirementLabelsJoined(): string {
    const req = this.requirements();
    if (!req?.requirements) {
      return '';
    }
    const missing = getMissingItemCreationRequirements(req.requirements);
    return missing.map((k) => this.t(`ITEMS.REQUIREMENT_LABEL.${k.toUpperCase()}`)).join(', ');
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
        .pipe(catchError(() => of([] as { id: string; name: string }[]))),
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
