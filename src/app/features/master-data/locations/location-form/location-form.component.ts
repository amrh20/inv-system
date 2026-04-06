import { Component, effect, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { first, map, switchMap } from 'rxjs/operators';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { NzMessageService } from 'ng-zorro-antd/message';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { AuthService } from '../../../../core/services/auth.service';
import type { LocationType } from '../../../../core/models/enums';
import { ItemMasterLookupsService } from '../../../items/services/item-master-lookups.service';
import { CategoriesService } from '../../services/categories.service';
import { LocationsService } from '../../services/locations.service';
import type { CategoryRow } from '../../models/category.model';
import type { LocationPayload, LocationRow } from '../../models/location.model';

const LOCATION_TYPES: { value: LocationType; label: string }[] = [
  { value: 'MAIN_STORE', label: 'LOCATIONS.TYPE_MAIN_STORE' },
  { value: 'OUTLET_STORE', label: 'LOCATIONS.TYPE_OUTLET_STORE' },
  { value: 'DEPARTMENT', label: 'LOCATIONS.TYPE_DEPARTMENT' },
];

@Component({
  selector: 'app-location-form',
  standalone: true,
  imports: [
    FormsModule,
    NzButtonModule,
    NzFormModule,
    NzInputModule,
    NzModalModule,
    NzSelectModule,
    NzSwitchModule,
    TranslatePipe,
  ],
  template: `
    <nz-modal
      [nzVisible]="visible()"
      [nzTitle]="(location() ? 'LOCATIONS.EDIT' : 'LOCATIONS.NEW') | translate"
      (nzOnCancel)="close()"
      nzWidth="500"
      [nzFooter]="footerTpl"
    >
      <ng-container *nzModalContent>
        @if (visible()) {
          <form nz-form nzLayout="vertical" (ngSubmit)="submit()">
            <nz-form-item>
              <nz-form-label [nzRequired]="true">{{ 'COMMON.NAME' | translate }}</nz-form-label>
              <nz-form-control>
                <input
                  nz-input
                  [placeholder]="'LOCATIONS.NAME_PLACEHOLDER' | translate"
                  [(ngModel)]="name"
                  name="name"
                  required
                />
              </nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label [nzRequired]="true">{{ 'COMMON.DEPARTMENT' | translate }}</nz-form-label>
              <nz-form-control>
                <nz-select
                  name="departmentId"
                  [(ngModel)]="departmentId"
                  [nzPlaceHolder]="'LOCATIONS.SELECT_DEPARTMENT' | translate"
                  nzAllowClear
                >
                  @for (d of departments(); track d.id) {
                    <nz-option [nzValue]="d.id" [nzLabel]="d.name" />
                  }
                </nz-select>
              </nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label>{{ 'COMMON.TYPE' | translate }}</nz-form-label>
              <nz-form-control>
                <nz-select
                  name="type"
                  [(ngModel)]="type"
                  [nzPlaceHolder]="'LOCATIONS.SELECT_TYPE' | translate"
                >
                  @for (t of locationTypes; track t.value) {
                    <nz-option [nzValue]="t.value" [nzLabel]="t.label | translate" />
                  }
                </nz-select>
              </nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label>{{ 'COMMON.DESCRIPTION' | translate }}</nz-form-label>
              <nz-form-control>
                <textarea
                  nz-input
                  [nzAutosize]="{ minRows: 2, maxRows: 4 }"
                  [placeholder]="'LOCATIONS.DESCRIPTION_PLACEHOLDER' | translate"
                  [(ngModel)]="description"
                  name="description"
                ></textarea>
              </nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label>{{ 'LOCATIONS.ACTIVE_STATUS' | translate }}</nz-form-label>
              <nz-form-control>
                <nz-switch
                  name="isActive"
                  [(ngModel)]="isActive"
                  [nzCheckedChildren]="('COMMON.ACTIVE' | translate)"
                  [nzUnCheckedChildren]="('COMMON.INACTIVE' | translate)"
                />
              </nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label>{{ 'LOCATIONS.ALLOWED_CATEGORIES' | translate }}</nz-form-label>
              <nz-form-control>
                <nz-select
                  name="categoryIds"
                  [(ngModel)]="categoryIds"
                  [nzPlaceHolder]="'LOCATIONS.SELECT_ALLOWED_CATEGORIES' | translate"
                  nzMode="multiple"
                  nzAllowClear
                  nzShowSearch
                >
                  @for (cat of allCategories(); track cat.id) {
                    <nz-option [nzValue]="cat.id" [nzLabel]="cat.name" />
                  }
                </nz-select>
              </nz-form-control>
            </nz-form-item>
          </form>
        }
      </ng-container>
      <ng-template #footerTpl>
        <button nz-button type="button" (click)="close()">{{ 'COMMON.CANCEL' | translate }}</button>
        <button
          nz-button
          nzType="primary"
          type="button"
          [disabled]="saving() || !name?.trim()"
          (click)="submit()"
        >
          {{ saving() ? ('COMMON.SAVING' | translate) : ('COMMON.SAVE' | translate) }}
        </button>
      </ng-template>
    </nz-modal>
  `,
})
export class LocationFormComponent {
  private readonly api = inject(LocationsService);
  private readonly lookups = inject(ItemMasterLookupsService);
  private readonly categoriesApi = inject(CategoriesService);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);
  private readonly auth = inject(AuthService);

  readonly visible = input(false);
  readonly location = input<LocationRow | null>(null);
  readonly closed = output<void>();
  readonly saved = output<LocationRow>();

  readonly locationTypes = LOCATION_TYPES;
  readonly departments = signal<{ id: string; name: string }[]>([]);
  readonly allCategories = signal<CategoryRow[]>([]);

  name = '';
  departmentId: string | null = null;
  type: LocationType = 'MAIN_STORE';
  description = '';
  isActive = true;
  categoryIds: string[] = [];
  readonly saving = signal(false);
  private wasModalOpen = false;

  constructor() {
    effect(() => {
      const open = this.visible();
      const loc = this.location();
      if (open && !this.wasModalOpen) {
        this.name = loc?.name ?? '';
        this.departmentId = loc?.departmentId ?? loc?.department?.id ?? null;
        this.type = loc?.type ?? 'MAIN_STORE';
        this.description = loc?.description ?? '';
        this.isActive = loc?.isActive ?? true;
        this.categoryIds = (loc?.allowedCategories ?? []).map((c) => c.id);
        this.loadDepartments();
        this.loadCategories();
        if (loc?.id && !loc?.allowedCategories) {
          this.api
            .getCategories(loc.id)
            .pipe(first())
            .subscribe({
              next: (cats) => {
                this.categoryIds = (cats ?? []).map((c) => c.id);
              },
              error: () => {
                this.categoryIds = [];
              },
            });
        }
      }
      this.wasModalOpen = open;
    });
  }

  loadDepartments(): void {
    this.lookups
      .listDepartments({ take: 200 })
      .pipe(first())
      .subscribe({
        next: (d) => this.departments.set(d),
        error: () => this.departments.set([]),
      });
  }

  loadCategories(): void {
    const tenantId = this.auth.currentTenant()?.id ?? undefined;
    this.categoriesApi
      .list({ take: 200, isActive: true, tenantId })
      .pipe(first())
      .subscribe({
        next: (res) => this.allCategories.set(res.categories ?? []),
        error: () => this.allCategories.set([]),
      });
  }

  close(): void {
    this.closed.emit();
  }

  submit(): void {
    if (!this.name?.trim()) return;
    const payload: LocationPayload = {
      name: this.name.trim(),
      departmentId: this.departmentId,
      type: this.type,
      description: this.description?.trim() || null,
      isActive: this.isActive,
      categoryIds: this.categoryIds,
    };
    const id = this.location()?.id;

    this.saving.set(true);
    const op = id ? this.api.update(id, payload) : this.api.create(payload);
    op.pipe(
      switchMap((res) =>
        this.api.setCategories(res.id, this.categoryIds).pipe(
          map(() => res),
        ),
      ),
      first(),
    ).subscribe({
      next: (res) => {
        this.saving.set(false);
        this.message.success(this.translate.instant('LOCATIONS.SAVED_SUCCESS'));
        this.saved.emit(res);
        this.close();
      },
      error: (err: { error?: { message?: string } }) => {
        this.saving.set(false);
        this.message.error(err?.error?.message ?? 'Failed to save location');
      },
    });
  }
}
