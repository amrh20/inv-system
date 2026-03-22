import { Component, effect, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { first } from 'rxjs/operators';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzMessageService } from 'ng-zorro-antd/message';
import { TranslatePipe } from '@ngx-translate/core';
import { CategoriesService } from '../../services/categories.service';
import type { SubcategoryPayload, SubcategoryRow } from '../../models/category.model';

@Component({
  selector: 'app-subcategory-form',
  standalone: true,
  imports: [FormsModule, NzButtonModule, NzFormModule, NzInputModule, NzModalModule, TranslatePipe],
  template: `
    <nz-modal
      [nzVisible]="visible()"
      [nzTitle]="(subcategory() ? 'CATEGORIES.EDIT_SUBCATEGORY' : 'CATEGORIES.NEW_SUBCATEGORY') | translate"
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
                  [placeholder]="'CATEGORIES.SUBCATEGORY_NAME_PLACEHOLDER' | translate"
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
export class SubcategoryFormComponent {
  private readonly api = inject(CategoriesService);
  private readonly message = inject(NzMessageService);

  readonly visible = input(false);
  readonly categoryId = input<string>('');
  readonly subcategory = input<SubcategoryRow | null>(null);
  readonly closed = output<void>();
  readonly saved = output<SubcategoryRow>();

  name = '';
  description = '';
  readonly saving = signal(false);

  constructor() {
    effect(() => {
      if (this.visible()) {
        const s = this.subcategory();
        this.name = s?.name ?? '';
        this.description = s?.description ?? '';
      }
    });
  }

  close(): void {
    this.closed.emit();
  }

  submit(): void {
    if (!this.name?.trim()) return;
    const payload: SubcategoryPayload = {
      name: this.name.trim(),
      description: this.description?.trim() || null,
    };
    const catId = this.categoryId();
    const subId = this.subcategory()?.id;

    this.saving.set(true);
    if (subId) {
      this.api
        .updateSubcategory(subId, payload)
        .pipe(first())
        .subscribe({
          next: (res) => {
            this.saving.set(false);
            this.saved.emit(res);
            this.close();
          },
          error: (err: { error?: { message?: string } }) => {
            this.saving.set(false);
            this.message.error(err?.error?.message ?? 'Failed to save subcategory');
          },
        });
    } else if (catId) {
      this.api
        .createSubcategory(catId, payload)
        .pipe(first())
        .subscribe({
          next: (res) => {
            this.saving.set(false);
            this.saved.emit(res);
            this.close();
          },
          error: (err: { error?: { message?: string } }) => {
            this.saving.set(false);
            this.message.error(err?.error?.message ?? 'Failed to create subcategory');
          },
        });
    } else {
      this.saving.set(false);
    }
  }
}
