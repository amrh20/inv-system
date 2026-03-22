import { Component, effect, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { first } from 'rxjs/operators';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzMessageService } from 'ng-zorro-antd/message';
import { TranslatePipe } from '@ngx-translate/core';
import { ItemMasterLookupsService } from '../../../items/services/item-master-lookups.service';
import { CategoriesService } from '../../services/categories.service';
import type { CategoryPayload, CategoryRow } from '../../models/category.model';

@Component({
  selector: 'app-category-form',
  standalone: true,
  imports: [
    FormsModule,
    NzButtonModule,
    NzFormModule,
    NzInputModule,
    NzModalModule,
    NzSelectModule,
    TranslatePipe,
  ],
  template: `
    <nz-modal
      [nzVisible]="visible()"
      [nzTitle]="(category() ? 'CATEGORIES.EDIT' : 'CATEGORIES.NEW') | translate"
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
                  [placeholder]="'CATEGORIES.NAME_PLACEHOLDER' | translate"
                  [(ngModel)]="name"
                  name="name"
                  required
                />
              </nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label>{{ 'COMMON.DESCRIPTION' | translate }}</nz-form-label>
              <nz-form-control>
                <textarea
                  nz-input
                  [nzAutosize]="{ minRows: 2, maxRows: 4 }"
                  [placeholder]="'CATEGORIES.DESCRIPTION_PLACEHOLDER' | translate"
                  [(ngModel)]="description"
                  name="description"
                ></textarea>
              </nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label>{{ 'COMMON.DEPARTMENT' | translate }}</nz-form-label>
              <nz-form-control>
                <nz-select
                  [ngModel]="departmentId"
                  (ngModelChange)="departmentId = $event"
                  [nzPlaceHolder]="'CATEGORIES.SELECT_DEPARTMENT' | translate"
                  nzAllowClear
                >
                  @for (d of departments(); track d.id) {
                    <nz-option [nzValue]="d.id" [nzLabel]="d.name" />
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
export class CategoryFormComponent {
  private readonly api = inject(CategoriesService);
  private readonly lookups = inject(ItemMasterLookupsService);
  private readonly message = inject(NzMessageService);

  readonly visible = input(false);
  readonly category = input<CategoryRow | null>(null);
  readonly closed = output<void>();
  readonly saved = output<CategoryRow>();

  readonly departments = signal<{ id: string; name: string }[]>([]);

  name = '';
  description = '';
  departmentId: string | null = null;
  readonly saving = signal(false);

  constructor() {
    effect(() => {
      if (this.visible()) {
        const c = this.category();
        this.name = c?.name ?? '';
        this.description = c?.description ?? '';
        this.departmentId = c?.departmentId ?? c?.department?.id ?? null;
        this.loadDepartments();
      }
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

  close(): void {
    this.closed.emit();
  }

  submit(): void {
    if (!this.name?.trim()) return;
    const payload: CategoryPayload = {
      name: this.name.trim(),
      description: this.description?.trim() || null,
      departmentId: this.departmentId || null,
    };
    const id = this.category()?.id;

    this.saving.set(true);
    const op = id ? this.api.update(id, payload) : this.api.create(payload);
    op.pipe(first()).subscribe({
      next: (res) => {
        this.saving.set(false);
        this.saved.emit(res);
        this.close();
      },
      error: (err: { error?: { message?: string } }) => {
        this.saving.set(false);
        this.message.error(err?.error?.message ?? 'Failed to save category');
      },
    });
  }
}
