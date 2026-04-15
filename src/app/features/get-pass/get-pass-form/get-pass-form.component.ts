import {
  Component,
  computed,
  DestroyRef,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { EMPTY, forkJoin, of, type Observable } from 'rxjs';
import { catchError, finalize, map, switchMap, tap } from 'rxjs/operators';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { LucideAngularModule } from 'lucide-angular';
import { ArrowLeft, Plus, Save, Send, Trash2 } from 'lucide-angular';
import type { GetPassType } from '../../../core/models/enums';
import type { DepartmentRow } from '../../master-data/models/department.model';
import type { LocationRow } from '../../master-data/models/location.model';
import { DepartmentsService } from '../../master-data/services/departments.service';
import { LocationsService } from '../../master-data/services/locations.service';
import type { ItemListRow } from '../../items/models/item.model';
import { ItemsService } from '../../items/services/items.service';
import { StockService } from '../../stock/services/stock.service';
import type { StockBalanceRow } from '../../stock/models/stock-balance.model';
import type { NzSelectItemInterface } from 'ng-zorro-antd/select';
import type {
  GetPassCreatePayload,
  GetPassDetail,
  GetPassUpdatePayload,
  SisterHotelRow,
} from '../models/get-pass.model';
import { GetPassService } from '../services/get-pass.service';
import { AuthService } from '../../../core/services/auth.service';
import { ConfirmationService } from '../../../core/services/confirmation.service';

interface LineDraft {
  locationId: string;
  itemId: string;
  qty: number | null;
  conditionOut: string;
}

/** Item row for nz-select: positive qty first, label shows on-hand qty. */
interface LineItemOption {
  id: string;
  label: string;
  /** Lowercased name + barcode for custom filter */
  searchText: string;
  qty: number;
}

@Component({
  selector: 'app-get-pass-form',
  standalone: true,
  providers: [ConfirmationService],
  imports: [
    FormsModule,
    NzAlertModule,
    NzButtonModule,
    NzCheckboxModule,
    NzDatePickerModule,
    NzInputModule,
    NzInputNumberModule,
    NzSelectModule,
    NzTableModule,
    TranslatePipe,
    LucideAngularModule,
  ],
  templateUrl: './get-pass-form.component.html',
  styleUrl: './get-pass-form.component.scss',
})
export class GetPassFormComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly api = inject(GetPassService);
  private readonly departmentsApi = inject(DepartmentsService);
  private readonly locationsApi = inject(LocationsService);
  private readonly stockApi = inject(StockService);
  private readonly itemsApi = inject(ItemsService);
  private readonly auth = inject(AuthService);
  private readonly confirmation = inject(ConfirmationService);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);

  readonly lucideBack = ArrowLeft;
  readonly lucideSave = Save;
  readonly lucideSend = Send;
  readonly lucidePlus = Plus;
  readonly lucideTrash = Trash2;

  /** Applied to item line nz-select overlay so list scrolls when many options (overlay is outside component DOM). */
  readonly itemSelectDropdownStyle: {
    maxHeight: string;
    overflowY: string;
    overscrollBehavior: string;
  } = {
    maxHeight: '320px',
    overflowY: 'auto',
    overscrollBehavior: 'contain',
  };

  readonly departments = signal<DepartmentRow[]>([]);
  /** Locations for the currently selected requesting department (from Locations API, not stock-balances). */
  readonly departmentLocations = signal<LocationRow[]>([]);
  /** Master item catalog for line item dropdowns (`GET /items` with `slim=true`). */
  readonly itemCatalog = signal<ItemListRow[]>([]);

  /**
   * Per-location on-hand quantities from stock-balances API only.
   * Keys: locationId → itemId → qty. Does not define which items exist — {@link itemCatalog} does.
   */
  readonly stockMap = signal<Record<string, Record<string, number>>>({});

  private readonly itemFilterCache = new Map<
    string,
    (input: string, option: NzSelectItemInterface) => boolean
  >();

  /**
   * Same `StockService.getStockBalances` contract as Stock Balances; high `take` so one location
   * returns all rows (Stock Balances UI uses 100 per request with filters — here we only scope by location).
   */
  private readonly gpStockTakePerLocation = 1000;

  readonly transferType = signal<GetPassType>('TEMPORARY');
  readonly departmentId = signal('');
  readonly borrowingEntity = signal('');
  /** Shown when transfer type is temporary (payload field `returnDate`). */
  readonly temporaryReturnDate = signal<Date | null>(null);
  /** Shown when transfer type is catering (payload field `expectedReturnDate`). */
  readonly cateringExpectedReturnDate = signal<Date | null>(null);
  readonly reason = signal('');
  readonly notes = signal('');
  readonly lines = signal<LineDraft[]>([{ locationId: '', itemId: '', qty: 1, conditionOut: '' }]);

  readonly sisterHotels = signal<SisterHotelRow[]>([]);
  readonly isInternalTransfer = signal(false);
  readonly targetTenantId = signal('');

  /**
   * Internal transfer UI is shown once sister destinations exist (API excludes current hotel;
   * empty when the property is standalone or is the only hotel in the group).
   */
  readonly showInternalTransferControls = computed(() => this.sisterHotels().length > 0);

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly editId = signal<string | null>(null);

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) this.editId.set(id);

    const sisters$ = this.canFetchSisterHotels()
      ? this.api.getSisterHotels().pipe(catchError(() => of([] as SisterHotelRow[])))
      : of([] as SisterHotelRow[]);

    forkJoin({
      d: this.departmentsApi.list({ slim: true, isActive: true }),
      items: this.itemsApi
        .list({ slim: true, isActive: true })
        .pipe(catchError(() => of({ items: [], total: 0 }))),
      sisters: sisters$,
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ d, items, sisters }) => {
          this.departments.set(d.departments);
          this.itemCatalog.set(items.items);
          this.sisterHotels.set(sisters);
          if (!id) {
            this.applyDefaultDepartmentFromProfile(d.departments);
            this.loadLocationsForCurrentDepartment();
            this.loading.set(false);
          } else {
            this.loadPass(id);
          }
        },
        error: () => {
          this.error.set(this.translate.instant('GET_PASS.FORM.ERROR_LOOKUPS'));
          this.loading.set(false);
        },
      });
  }

  /**
   * Sister-hotel list is loaded when the user may create get passes and the current property
   * belongs to an organization: either org-root context (branches under this tenant) or a hotel
   * tenant with a `parentId` (branch under an org). Hotel admins only need one membership; the
   * tenant’s parent link is enough—no second sibling membership is required.
   */
  private canFetchSisterHotels(): boolean {
    if (!this.auth.hasPermission('GET_PASS_CREATE')) {
      return false;
    }
    if (this.auth.isParentOrganizationContext()) {
      return true;
    }
    const hasParent = this.currentTenantHasParentOrganization();
    const ct = this.auth.currentTenant();
    const u = this.auth.currentUser();
    const memberships = u?.memberships ?? [];
    const tid = ct?.id;
    const slug = ct?.slug ?? undefined;
    const cur =
      (tid ? memberships.find((m) => m.tenantId === tid) : undefined) ??
      (slug ? memberships.find((m) => m.tenantSlug === slug) : undefined);
    console.debug('[get-pass] sister hotels fetch', {
      willFetch: hasParent,
      currentTenantParentId: ct?.parentId ?? null,
      membershipParentId: cur?.parentId ?? null,
      userTenantParentId: u?.tenant?.parentId ?? null,
      currentTenantHasParentOrganization: hasParent,
    });
    return hasParent;
  }

  /** True when the active hotel tenant is under a parent organization (`parentId` set). */
  private currentTenantHasParentOrganization(): boolean {
    const ct = this.auth.currentTenant();
    if (ct?.parentId) {
      return true;
    }
    const tid = ct?.id;
    const slug = ct?.slug ?? undefined;
    const u = this.auth.currentUser();
    if (!u) {
      return false;
    }
    const memberships = u.memberships ?? [];
    const cur =
      (tid ? memberships.find((m) => m.tenantId === tid) : undefined) ??
      (slug ? memberships.find((m) => m.tenantSlug === slug) : undefined);
    if (cur?.parentId) {
      return true;
    }
    return !!u.tenant?.parentId;
  }

  /**
   * Loads locations for {@link departmentId} into {@link departmentLocations},
   * reconciles line source locations, and optionally applies single-location auto-fill.
   */
  private loadLocationsForCurrentDepartment(options?: { runAutoSingle?: boolean }): void {
    const runAuto = options?.runAutoSingle !== false;
    const deptId = this.departmentId();
    if (!deptId) {
      this.departmentLocations.set([]);
      this.reconcileLinesToAllowedLocations(new Set());
      return;
    }
    const captured = deptId;
    this.locationsApi
      .list({ departmentId: captured, slim: true, isActive: true })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (r) => {
          if (this.departmentId() !== captured) return;
          this.departmentLocations.set(r.locations);
          const allowed = new Set(r.locations.map((l) => l.id));
          this.reconcileLinesToAllowedLocations(allowed);
          if (runAuto) this.applyAutoSingleLocationToAllLines();
        },
        error: () => {
          this.message.error(this.translate.instant('GET_PASS.FORM.ERROR_LOOKUPS'));
          if (this.departmentId() === captured) {
            this.departmentLocations.set([]);
            this.reconcileLinesToAllowedLocations(new Set());
          }
        },
      });
  }

  private reconcileLinesToAllowedLocations(allowed: Set<string>): void {
    this.lines.update((rows) =>
      rows.map((line) => {
        if (!line.locationId || !allowed.has(line.locationId)) {
          return { ...line, locationId: '', itemId: '', qty: 1 };
        }
        return line;
      }),
    );
  }

  onDepartmentChange(id: string): void {
    this.departmentId.set(id);
    this.loadLocationsForCurrentDepartment();
  }

  /**
   * When the department has exactly one location, prefill empty line locations and preload stock.
   */
  private applyAutoSingleLocationToAllLines(): void {
    const locs = this.departmentLocations();
    if (locs.length !== 1) return;
    const onlyId = locs[0].id;
    this.lines.update((rows) =>
      rows.map((line) =>
        !line.locationId ? { ...line, locationId: onlyId, itemId: '', qty: 1 } : line,
      ),
    );
    this.ensureStock(onlyId);
  }

  onTransferTypeChange(value: GetPassType): void {
    this.transferType.set(value);
    if (value === 'PERMANENT') {
      this.temporaryReturnDate.set(null);
      this.cateringExpectedReturnDate.set(null);
    } else if (value === 'TEMPORARY') {
      this.cateringExpectedReturnDate.set(null);
    } else if (value === 'CATERING' || value === 'OUTSIDE_CATERING') {
      this.temporaryReturnDate.set(null);
    }
  }

  onInternalTransferChange(checked: boolean): void {
    this.isInternalTransfer.set(checked);
    if (!checked) {
      this.targetTenantId.set('');
      return;
    }
    const id = this.targetTenantId();
    const h = id ? this.sisterHotels().find((x) => x.id === id) : undefined;
    if (h) {
      this.borrowingEntity.set(h.name);
    }
  }

  onTargetTenantChange(id: string): void {
    this.targetTenantId.set(id);
    if (!this.isInternalTransfer()) return;
    const h = this.sisterHotels().find((x) => x.id === id);
    if (h) {
      this.borrowingEntity.set(h.name);
    }
  }

  /**
   * Prefill requesting department from membership `departmentId`, or match legacy `user.department` text to name/code.
   */
  private applyDefaultDepartmentFromProfile(depts: DepartmentRow[]): void {
    const user = this.auth.currentUser();
    if (!user) return;
    const ids = new Set(depts.map((d) => d.id));
    if (user.departmentId && ids.has(user.departmentId)) {
      this.departmentId.set(user.departmentId);
      return;
    }
    const label = user.department?.trim();
    if (!label) return;
    const lower = label.toLowerCase();
    const byName = depts.find((d) => d.name.trim().toLowerCase() === lower);
    if (byName) {
      this.departmentId.set(byName.id);
      return;
    }
    const byCode = depts.find((d) => d.code.trim().toLowerCase() === lower);
    if (byCode) {
      this.departmentId.set(byCode.id);
    }
  }

  /** Max on-hand qty when stock for the location is loaded; `undefined` = unknown / not loaded yet. */
  qtyCapForLine(line: LineDraft): number | undefined {
    if (!line.locationId || !line.itemId) return undefined;
    const byLoc = this.stockMap()[line.locationId];
    if (byLoc === undefined) return undefined;
    const q = byLoc[line.itemId];
    return q !== undefined ? Math.max(0, q) : 0;
  }

  /** Upper bound for `nz-input-number` only when stock allows at least one unit (avoids nzMin/nzMax conflict at zero). */
  qtyMaxForInput(line: LineDraft): number | undefined {
    const c = this.qtyCapForLine(line);
    if (c === undefined || c < 0.01) return undefined;
    return c;
  }

  onLineQtyChange(index: number, value: number | null): void {
    const line = this.lines()[index];
    if (!line) return;
    const cap = this.qtyCapForLine({ ...line, qty: value });
    let qty = value;
    if (cap !== undefined && qty != null && qty > cap) {
      qty = cap >= 0.01 ? cap : null;
      this.message.warning(
        this.translate.instant('GET_PASS.FORM.QTY_EXCEEDS_STOCK', { max: cap }),
      );
    }
    this.updateLine(index, { qty });
  }

  private formatQtyDisplay(q: number): string {
    if (!Number.isFinite(q)) return '0';
    const rounded = Math.round(q * 10000) / 10000;
    return String(rounded);
  }

  /** Collapse API balance rows into itemId → summed on-hand (response shape only). */
  private qtyMapFromBalances(balances: StockBalanceRow[]): Record<string, number> {
    const out: Record<string, number> = {};
    for (const b of balances) {
      const itemId =
        b.itemId != null && String(b.itemId).trim() !== '' ? String(b.itemId).trim() : '';
      if (!itemId) continue;
      const q = Number(b.qtyOnHand);
      const n = Number.isFinite(q) ? q : 0;
      out[itemId] = (out[itemId] ?? 0) + Math.max(0, n);
    }
    return out;
  }

  /**
   * Row source is stock balances for the selected location: active catalog items with on-hand > 0.
   * Keep the currently selected item visible even if balance dropped to zero while editing.
   */
  lineItemOptions(locationId: string, selectedItemId?: string): LineItemOption[] {
    if (!locationId) return [];
    const qtyByItem = this.stockMap()[locationId];
    if (qtyByItem === undefined) return [];
    const selected = selectedItemId?.trim() ?? '';
    const catalogById = new Map(this.itemCatalog().map((item) => [item.id, item] as const));
    const out: LineItemOption[] = [];
    for (const [itemId, rawQty] of Object.entries(qtyByItem)) {
      const qty = Math.max(0, Number(rawQty) || 0);
      if (qty < 0.01 && itemId !== selected) {
        continue;
      }
      const cat = catalogById.get(itemId);
      const name = cat?.name != null ? String(cat.name).trim() : itemId;
      const barcode = cat?.barcode != null ? String(cat.barcode).trim() : '';
      const avail = this.translate.instant('GET_PASS.FORM.ITEM_AVAILABLE_SUFFIX', {
        qty: this.formatQtyDisplay(qty),
      });
      const label = `${name} (${avail})`;
      const searchText =
        `${name} ${barcode}`.toLowerCase().trim() || itemId.toLowerCase();
      out.push({ id: itemId, label, searchText, qty });
    }
    out.sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }));
    return out;
  }

  getItemFilterForLocation(
    locationId: string,
  ): (input: string, option: NzSelectItemInterface) => boolean {
    if (!locationId) {
      return () => true;
    }
    let fn = this.itemFilterCache.get(locationId);
    if (!fn) {
      fn = (input, option) => {
        const id = String(option.nzValue ?? '');
        const opts = this.lineItemOptions(locationId);
        const row = opts.find((o) => o.id === id);
        if (!row) return !input?.trim();
        const q = (input ?? '').toLowerCase().trim();
        if (!q) return true;
        return row.searchText.includes(q);
      };
      this.itemFilterCache.set(locationId, fn);
    }
    return fn;
  }

  /** Location chosen but the master catalog failed to load (no rows to pick from). */
  showNoItemsInLocationMessage(line: LineDraft): boolean {
    if (!line.locationId) return false;
    const qtyByItem = this.stockMap()[line.locationId];
    if (qtyByItem === undefined) return false;
    return this.lineItemOptions(line.locationId, line.itemId).length === 0;
  }

  /** Merge fetched quantities into {@link stockMap}; catalog / dropdown options are unchanged. */
  private applyStockMapForLocation(locationId: string, qtyByItem: Record<string, number>): void {
    this.itemFilterCache.delete(locationId);
    this.stockMap.update((m) => ({ ...m, [locationId]: qtyByItem }));
  }

  private ensureStock(locationId: string): void {
    if (!locationId) return;
    this.stockApi
      .getStockBalances({
        locationId,
        take: this.gpStockTakePerLocation,
        showZero: 'false',
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (r) => {
          this.applyStockMapForLocation(locationId, this.qtyMapFromBalances(r.balances));
        },
        error: () => this.message.error(this.translate.instant('GET_PASS.FORM.ERROR_STOCK')),
      });
  }

  /** Load stock for any line locations not yet cached (so save can validate qty vs on-hand). */
  private ensureStockCachedForLines$(lineSnapshot: LineDraft[]) {
    const locIds = [...new Set(lineSnapshot.map((l) => l.locationId).filter(Boolean))];
    const missing = locIds.filter((id) => this.stockMap()[id] === undefined);
    if (missing.length === 0) {
      return of(void 0);
    }
    return forkJoin(
      missing.map((locId) =>
        this.stockApi
          .getStockBalances({
            locationId: locId,
            take: this.gpStockTakePerLocation,
            showZero: 'false',
          })
          .pipe(
            map((r) => ({
              locId,
              qtyByItem: this.qtyMapFromBalances(r.balances),
            })),
          ),
      ),
    ).pipe(
      tap((results) => {
        for (const { locId } of results) {
          this.itemFilterCache.delete(locId);
        }
        this.stockMap.update((m) => {
          let acc = { ...m };
          for (const { locId, qtyByItem } of results) {
            acc = { ...acc, [locId]: qtyByItem };
          }
          return acc;
        });
      }),
      map(() => undefined),
    );
  }

  private validateQtyAgainstStock(lineSnapshot: LineDraft[]): boolean {
    for (const l of lineSnapshot) {
      const cap = this.qtyCapForLine(l);
      if (cap !== undefined && l.qty != null && l.qty > cap + 1e-9) {
        this.message.warning(
          this.translate.instant('GET_PASS.FORM.QTY_EXCEEDS_STOCK', { max: cap }),
        );
        return false;
      }
    }
    return true;
  }

  onLineLocationChange(index: number, locationId: string): void {
    this.lines.update((rows) => {
      const next = [...rows];
      if (next[index]) next[index] = { ...next[index], locationId, itemId: '', qty: 1 };
      return next;
    });
    this.ensureStock(locationId);
  }

  onLineItemChange(index: number, itemId: string | null): void {
    const id = itemId ?? '';
    const line = this.lines()[index];
    if (!line) return;
    const draft = { ...line, itemId: id };
    const cap = this.qtyCapForLine(draft);
    let qty = line.qty;
    if (cap !== undefined) {
      if (cap < 0.01) {
        this.message.warning(this.translate.instant('GET_PASS.FORM.NO_STOCK_FOR_ITEM'));
        qty = null;
      } else if (qty != null && qty > cap) {
        qty = cap;
        this.message.warning(
          this.translate.instant('GET_PASS.FORM.QTY_EXCEEDS_STOCK', { max: cap }),
        );
      }
    }
    this.updateLine(index, { itemId: id, qty });
  }

  addLine(): void {
    const locs = this.departmentLocations();
    const defaultLoc = locs.length === 1 ? locs[0].id : '';
    this.lines.update((rows) => [
      ...rows,
      { locationId: defaultLoc, itemId: '', qty: 1, conditionOut: '' },
    ]);
    if (defaultLoc) {
      this.ensureStock(defaultLoc);
    }
  }

  removeLine(index: number): void {
    this.lines.update((rows) => rows.filter((_, i) => i !== index));
  }

  updateLine(index: number, patch: Partial<LineDraft>): void {
    this.lines.update((rows) => {
      const next = [...rows];
      if (next[index]) next[index] = { ...next[index], ...patch };
      return next;
    });
  }

  private loadPass(id: string): void {
    this.api
      .getById(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (p) => {
          if (p.status !== 'DRAFT') {
            this.error.set(this.translate.instant('GET_PASS.FORM.ERROR_NOT_DRAFT'));
            this.loading.set(false);
            return;
          }
          this.transferType.set(p.transferType);
          this.departmentId.set(p.departmentId ?? '');
          this.borrowingEntity.set(p.borrowingEntity);
          this.isInternalTransfer.set(!!p.isInternalTransfer);
          this.targetTenantId.set(p.targetTenantId?.trim() ?? '');
          if (p.transferType === 'TEMPORARY') {
            const raw = p.returnDate ?? p.expectedReturnDate;
            this.temporaryReturnDate.set(raw ? new Date(raw) : null);
            this.cateringExpectedReturnDate.set(null);
          } else if (p.transferType === 'CATERING' || p.transferType === 'OUTSIDE_CATERING') {
            this.temporaryReturnDate.set(null);
            this.cateringExpectedReturnDate.set(
              p.expectedReturnDate ? new Date(p.expectedReturnDate) : null,
            );
          } else {
            this.temporaryReturnDate.set(null);
            this.cateringExpectedReturnDate.set(null);
          }
          this.reason.set(p.reason ?? '');
          this.notes.set(p.notes ?? '');
          const lineDrafts: LineDraft[] = p.lines.map((l) => ({
            locationId: l.locationId,
            itemId: l.itemId,
            qty: Number(l.qty),
            conditionOut: l.conditionOut ?? '',
          }));
          this.lines.set(lineDrafts.length ? lineDrafts : [{ locationId: '', itemId: '', qty: 1, conditionOut: '' }]);
          const locIds = [...new Set(lineDrafts.map((l) => l.locationId).filter(Boolean))];
          const deptId = p.departmentId ?? '';

          const locations$ =
            deptId
              ? this.locationsApi.list({ departmentId: deptId, slim: true, isActive: true }).pipe(
                  catchError(() => {
                    this.message.error(this.translate.instant('GET_PASS.FORM.ERROR_LOOKUPS'));
                    return of({ locations: [] as LocationRow[], total: 0 });
                  }),
                )
              : of({ locations: [] as LocationRow[], total: 0 });

          locations$
            .pipe(
              takeUntilDestroyed(this.destroyRef),
              tap((r) => {
                this.departmentLocations.set(r.locations);
                const allowed = new Set(r.locations.map((l) => l.id));
                this.reconcileLinesToAllowedLocations(allowed);
              }),
              switchMap(() => {
                if (locIds.length === 0) {
                  return of([] as { locId: string; qtyByItem: Record<string, number> }[]);
                }
                return forkJoin(
                  locIds.map((locId) =>
                    this.stockApi
                      .getStockBalances({
                        locationId: locId,
                        take: this.gpStockTakePerLocation,
                        showZero: 'false',
                      })
                      .pipe(
                        map((r) => ({
                          locId,
                          qtyByItem: this.qtyMapFromBalances(r.balances),
                        })),
                      ),
                  ),
                );
              }),
            )
            .subscribe({
              next: (results) => {
                for (const { locId } of results) {
                  this.itemFilterCache.delete(locId);
                }
                this.stockMap.update((m) => {
                  let acc = { ...m };
                  for (const { locId, qtyByItem } of results) {
                    acc = { ...acc, [locId]: qtyByItem };
                  }
                  return acc;
                });
                this.loading.set(false);
              },
              error: () => {
                this.message.error(this.translate.instant('GET_PASS.FORM.ERROR_STOCK'));
                this.loading.set(false);
              },
            });
        },
        error: () => {
          this.error.set(this.translate.instant('GET_PASS.FORM.ERROR_LOAD'));
          this.loading.set(false);
        },
      });
  }

  back(): void {
    this.router.navigate(['/get-passes']);
  }

  /** Save as DRAFT only (create or update); does not submit for approval. */
  saveDraft(): void {
    const pack = this.tryGatherValidatedDraft();
    if (!pack) return;
    const { deptId, entity, tt, cleanLines } = pack;
    const hadId = !!this.editId();
    this.ensureStockCachedForLines$(cleanLines)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        switchMap(() => {
          if (!this.validateQtyAgainstStock(cleanLines)) {
            return EMPTY;
          }
          this.saving.set(true);
          return this.persistDraft$(deptId, entity, tt, cleanLines).pipe(
            finalize(() => this.saving.set(false)),
          );
        }),
      )
      .subscribe({
        next: (doc) => {
          this.message.success(
            this.translate.instant(hadId ? 'GET_PASS.FORM.SAVED' : 'GET_PASS.FORM.CREATED'),
          );
          if (!hadId) {
            this.editId.set(doc.id);
            void this.router.navigate(['/get-passes', doc.id, 'edit'], { replaceUrl: true });
          }
        },
        error: (e: Error) =>
          this.message.error(e.message || this.translate.instant('GET_PASS.FORM.ERROR_SAVE')),
      });
  }

  /** Validate, persist draft, then submit so status becomes PENDING_DEPT. */
  submitForApproval(): void {
    const pack = this.tryGatherValidatedDraft();
    if (!pack) return;
    const { deptId, entity, tt, cleanLines } = pack;
    this.confirmation
      .confirm({
        title: this.translate.instant('GET_PASS.FORM.SUBMIT_CONFIRM_TITLE'),
        message: this.translate.instant('GET_PASS.FORM.SUBMIT_CONFIRM_MSG'),
        confirmText: this.translate.instant('GET_PASS.FORM.SUBMIT_FOR_APPROVAL'),
        cancelText: this.translate.instant('COMMON.CANCEL'),
      })
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        switchMap((ok) => (ok ? of(pack) : EMPTY)),
        switchMap((p) =>
          this.ensureStockCachedForLines$(p.cleanLines).pipe(map(() => p)),
        ),
        switchMap((p) => {
          if (!this.validateQtyAgainstStock(p.cleanLines)) {
            return EMPTY;
          }
          this.saving.set(true);
          return this.persistDraft$(p.deptId, p.entity, p.tt, p.cleanLines).pipe(
            switchMap((doc) => this.api.submit(doc.id)),
            finalize(() => this.saving.set(false)),
          );
        }),
      )
      .subscribe({
        next: () => {
          this.message.success(
            this.translate.instant('GET_PASS.FORM.MSG_SUBMITTED_APPROVAL'),
          );
          void this.router.navigate(['/get-passes']);
        },
        error: (e: Error) =>
          this.message.error(e.message || this.translate.instant('GET_PASS.FORM.ERROR_SAVE')),
      });
  }

  private tryGatherValidatedDraft():
    | { deptId: string; entity: string; tt: GetPassType; cleanLines: LineDraft[] }
    | null {
    const deptId = this.departmentId();
    const tt = this.transferType();
    const rows = this.lines();
    const wantsInternal = this.isInternalTransfer();
    const canPickSister = this.showInternalTransferControls();
    const targetId = this.targetTenantId().trim();

    if (!deptId) {
      this.message.warning(this.translate.instant('GET_PASS.FORM.VALIDATION_DEPT'));
      return null;
    }
    if (wantsInternal && canPickSister) {
      if (!targetId) {
        this.message.warning(this.translate.instant('GET_PASS.FORM.VALIDATION_INTERNAL_TARGET'));
        return null;
      }
    } else if (!wantsInternal) {
      if (!this.borrowingEntity().trim()) {
        this.message.warning(this.translate.instant('GET_PASS.FORM.VALIDATION_ENTITY'));
        return null;
      }
    } else if (!this.borrowingEntity().trim()) {
      this.message.warning(this.translate.instant('GET_PASS.FORM.VALIDATION_ENTITY'));
      return null;
    }

    if (tt === 'TEMPORARY' && !this.temporaryReturnDate()) {
      this.message.warning(this.translate.instant('GET_PASS.FORM.VALIDATION_RETURN_TEMP'));
      return null;
    }
    if ((tt === 'CATERING' || tt === 'OUTSIDE_CATERING') && !this.cateringExpectedReturnDate()) {
      this.message.warning(this.translate.instant('GET_PASS.FORM.VALIDATION_RETURN_CATERING'));
      return null;
    }

    const entity =
      wantsInternal && canPickSister && targetId
        ? (
            this.sisterHotels().find((h) => h.id === targetId)?.name ??
            this.borrowingEntity() ??
            ''
          ).trim()
        : this.borrowingEntity().trim();
    if (wantsInternal && canPickSister && !entity) {
      this.message.warning(this.translate.instant('GET_PASS.FORM.VALIDATION_INTERNAL_TARGET'));
      return null;
    }

    const cleanLines = rows.filter((l) => l.locationId && l.itemId && l.qty && l.qty > 0);
    if (cleanLines.length === 0) {
      this.message.warning(this.translate.instant('GET_PASS.FORM.VALIDATION_LINES'));
      return null;
    }
    return { deptId, entity, tt, cleanLines };
  }

  private persistDraft$(
    deptId: string,
    entity: string,
    tt: GetPassType,
    cleanLines: LineDraft[],
  ): Observable<GetPassDetail> {
    const isInt = this.isInternalTransfer();
    const targetId = isInt ? this.targetTenantId().trim() : '';

    const tempDate = this.temporaryReturnDate();
    const caterDate = this.cateringExpectedReturnDate();

    const returnDateIso =
      tt === 'TEMPORARY' && tempDate ? (tempDate as Date).toISOString() : null;

    const expectedReturnDateIso =
      tt === 'PERMANENT'
        ? null
        : (tt === 'CATERING' || tt === 'OUTSIDE_CATERING') && caterDate
          ? (caterDate as Date).toISOString()
          : tt === 'TEMPORARY' && tempDate
            ? (tempDate as Date).toISOString()
            : null;

    const linesPayload = cleanLines.map((l) => ({
      itemId: l.itemId,
      locationId: l.locationId,
      qty: l.qty as number,
      conditionOut: l.conditionOut.trim() || null,
    }));

    const id = this.editId();
    if (id) {
      const body: GetPassUpdatePayload = {
        transferType: tt,
        departmentId: deptId,
        borrowingEntity: entity,
        expectedReturnDate: expectedReturnDateIso,
        returnDate: returnDateIso,
        isInternalTransfer: isInt,
        targetTenantId: isInt ? targetId || null : null,
        reason: this.reason().trim() || null,
        notes: this.notes().trim() || null,
        lines: linesPayload,
      };
      return this.api.update(id, body);
    }
    const body: GetPassCreatePayload = {
      transferType: tt,
      departmentId: deptId,
      borrowingEntity: entity,
      expectedReturnDate: expectedReturnDateIso,
      returnDate: returnDateIso,
      isInternalTransfer: isInt,
      targetTenantId: isInt ? targetId || null : null,
      reason: this.reason().trim() || null,
      notes: this.notes().trim() || null,
      lines: linesPayload,
    };
    return this.api.create(body);
  }
}
