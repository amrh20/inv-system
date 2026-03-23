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
import { map } from 'rxjs/operators';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { LucideAngularModule } from 'lucide-angular';
import { ArrowLeft, Plus, Save, Trash2 } from 'lucide-angular';
import type { GetPassType } from '../../../core/models/enums';
import type { DepartmentRow } from '../../master-data/models/department.model';
import type { LocationRow } from '../../master-data/models/location.model';
import { DepartmentsService } from '../../master-data/services/departments.service';
import { LocationsService } from '../../master-data/services/locations.service';
import { StockService } from '../../stock/services/stock.service';
import type { StockBalanceRow } from '../../stock/models/stock-balance.model';
import type { GetPassCreatePayload, GetPassUpdatePayload } from '../models/get-pass.model';
import { GetPassService } from '../services/get-pass.service';

interface LineDraft {
  locationId: string;
  itemId: string;
  qty: number | null;
  conditionOut: string;
}

@Component({
  selector: 'app-get-pass-form',
  standalone: true,
  imports: [
    FormsModule,
    NzAlertModule,
    NzButtonModule,
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
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);

  readonly lucideBack = ArrowLeft;
  readonly lucideSave = Save;
  readonly lucidePlus = Plus;
  readonly lucideTrash = Trash2;

  readonly departments = signal<DepartmentRow[]>([]);
  readonly locations = signal<LocationRow[]>([]);
  /** Stock rows keyed by location for item pick lists */
  readonly stockByLocation = signal<Record<string, StockBalanceRow[]>>({});

  readonly transferType = signal<GetPassType>('TEMPORARY');
  readonly departmentId = signal('');
  readonly borrowingEntity = signal('');
  readonly expectedReturnDate = signal<Date | null>(null);
  readonly reason = signal('');
  readonly notes = signal('');
  readonly lines = signal<LineDraft[]>([{ locationId: '', itemId: '', qty: 1, conditionOut: '' }]);

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly editId = signal<string | null>(null);

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) this.editId.set(id);

    forkJoin({
      d: this.departmentsApi.list({ take: 200, isActive: true }),
      l: this.locationsApi.list({ take: 500, isActive: true }),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ d, l }) => {
          this.departments.set(d.departments);
          this.locations.set(l.locations);
          if (id) this.loadPass(id);
          else this.loading.set(false);
        },
        error: () => {
          this.error.set(this.translate.instant('GET_PASS.FORM.ERROR_LOOKUPS'));
          this.loading.set(false);
        },
      });
  }

  filteredLocations(): LocationRow[] {
    const deptId = this.departmentId();
    if (!deptId) return this.locations();
    return this.locations().filter((loc) => loc.departmentId === deptId);
  }

  onDepartmentChange(id: string): void {
    this.departmentId.set(id);
  }

  itemsForLocation(locationId: string): Array<{ id: string; label: string }> {
    if (!locationId) return [];
    const rows = this.stockByLocation()[locationId] ?? [];
    const map = new Map<string, string>();
    for (const b of rows) {
      if (b.item && !map.has(b.itemId)) {
        map.set(b.itemId, b.item.name);
      }
    }
    return [...map.entries()].map(([id, name]) => ({ id, label: name }));
  }

  private ensureStock(locationId: string): void {
    if (!locationId || this.stockByLocation()[locationId]) return;
    this.stockApi
      .getStockBalances({ locationId, take: 5000 })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (r) => {
          this.stockByLocation.update((m) => ({ ...m, [locationId]: r.balances }));
        },
        error: () => this.message.error(this.translate.instant('GET_PASS.FORM.ERROR_STOCK')),
      });
  }

  onLineLocationChange(index: number, locationId: string): void {
    this.lines.update((rows) => {
      const next = [...rows];
      if (next[index]) next[index] = { ...next[index], locationId, itemId: '' };
      return next;
    });
    this.ensureStock(locationId);
  }

  addLine(): void {
    this.lines.update((rows) => [...rows, { locationId: '', itemId: '', qty: 1, conditionOut: '' }]);
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
          this.expectedReturnDate.set(p.expectedReturnDate ? new Date(p.expectedReturnDate) : null);
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
          if (locIds.length === 0) {
            this.loading.set(false);
            return;
          }
          forkJoin(
            locIds.map((locId) =>
              this.stockApi.getStockBalances({ locationId: locId, take: 5000 }).pipe(
                map((r) => ({ locId, balances: r.balances })),
              ),
            ),
          )
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
              next: (results) => {
                this.stockByLocation.update((m) => {
                  let acc = { ...m };
                  for (const { locId, balances } of results) {
                    acc = { ...acc, [locId]: balances };
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

  save(): void {
    const deptId = this.departmentId();
    const entity = this.borrowingEntity().trim();
    const tt = this.transferType();
    const rows = this.lines();
    if (!deptId || !entity) {
      this.message.warning(this.translate.instant('GET_PASS.FORM.VALIDATION_HEADER'));
      return;
    }
    if (tt !== 'PERMANENT' && !this.expectedReturnDate()) {
      this.message.warning(this.translate.instant('GET_PASS.FORM.VALIDATION_RETURN'));
      return;
    }
    const cleanLines = rows.filter((l) => l.locationId && l.itemId && l.qty && l.qty > 0);
    if (cleanLines.length === 0) {
      this.message.warning(this.translate.instant('GET_PASS.FORM.VALIDATION_LINES'));
      return;
    }

    const exp =
      tt === 'PERMANENT'
        ? null
        : (this.expectedReturnDate() as Date).toISOString();

    this.saving.set(true);
    const id = this.editId();
    if (id) {
      const body: GetPassUpdatePayload = {
        transferType: tt,
        departmentId: deptId,
        borrowingEntity: entity,
        expectedReturnDate: exp,
        reason: this.reason().trim() || null,
        notes: this.notes().trim() || null,
        lines: cleanLines.map((l) => ({
          itemId: l.itemId,
          locationId: l.locationId,
          qty: l.qty as number,
          conditionOut: l.conditionOut.trim() || null,
        })),
      };
      this.api
        .update(id, body)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: () => {
            this.saving.set(false);
            this.message.success(this.translate.instant('GET_PASS.FORM.SAVED'));
            this.router.navigate(['/get-passes']);
          },
          error: (e: Error) => {
            this.saving.set(false);
            this.message.error(e.message || this.translate.instant('GET_PASS.FORM.ERROR_SAVE'));
          },
        });
    } else {
      const body: GetPassCreatePayload = {
        transferType: tt,
        departmentId: deptId,
        borrowingEntity: entity,
        expectedReturnDate: exp,
        reason: this.reason().trim() || null,
        notes: this.notes().trim() || null,
        lines: cleanLines.map((l) => ({
          itemId: l.itemId,
          locationId: l.locationId,
          qty: l.qty as number,
          conditionOut: l.conditionOut.trim() || null,
        })),
      };
      this.api
        .create(body)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (doc) => {
            this.saving.set(false);
            this.message.success(this.translate.instant('GET_PASS.FORM.CREATED'));
            this.router.navigate(['/get-passes', doc.id]);
          },
          error: (e: Error) => {
            this.saving.set(false);
            this.message.error(e.message || this.translate.instant('GET_PASS.FORM.ERROR_SAVE'));
          },
        });
    }
  }
}
