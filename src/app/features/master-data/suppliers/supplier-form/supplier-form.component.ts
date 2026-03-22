import { Component, effect, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { first } from 'rxjs/operators';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzMessageService } from 'ng-zorro-antd/message';
import { TranslatePipe } from '@ngx-translate/core';
import { SuppliersService } from '../../services/suppliers.service';
import type { SupplierPayload, SupplierRow } from '../../models/supplier.model';

@Component({
  selector: 'app-supplier-form',
  standalone: true,
  imports: [FormsModule, NzButtonModule, NzFormModule, NzInputModule, NzModalModule, TranslatePipe],
  template: `
    <nz-modal
      [nzVisible]="visible()"
      [nzTitle]="(supplier() ? 'SUPPLIERS.EDIT' : 'SUPPLIERS.NEW') | translate"
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
                  [placeholder]="'SUPPLIERS.NAME_PLACEHOLDER' | translate"
                  [(ngModel)]="name"
                  name="name"
                  required
                />
              </nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label>{{ 'SUPPLIERS.CONTACT_PERSON' | translate }}</nz-form-label>
              <nz-form-control>
                <input
                  nz-input
                  [placeholder]="'SUPPLIERS.CONTACT_PERSON_PLACEHOLDER' | translate"
                  [(ngModel)]="contactPerson"
                  name="contactPerson"
                />
              </nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label>{{ 'SUPPLIERS.PHONE' | translate }}</nz-form-label>
              <nz-form-control>
                <input
                  nz-input
                  [placeholder]="'SUPPLIERS.PHONE_PLACEHOLDER' | translate"
                  [(ngModel)]="phone"
                  name="phone"
                />
              </nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label>{{ 'SUPPLIERS.EMAIL' | translate }}</nz-form-label>
              <nz-form-control>
                <input
                  nz-input
                  type="email"
                  [placeholder]="'SUPPLIERS.EMAIL_PLACEHOLDER' | translate"
                  [(ngModel)]="email"
                  name="email"
                />
              </nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label>{{ 'SUPPLIERS.ADDRESS' | translate }}</nz-form-label>
              <nz-form-control>
                <textarea
                  nz-input
                  [nzAutosize]="{ minRows: 2, maxRows: 4 }"
                  [placeholder]="'SUPPLIERS.ADDRESS_PLACEHOLDER' | translate"
                  [(ngModel)]="address"
                  name="address"
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
export class SupplierFormComponent {
  private readonly api = inject(SuppliersService);
  private readonly message = inject(NzMessageService);

  readonly visible = input(false);
  readonly supplier = input<SupplierRow | null>(null);
  readonly closed = output<void>();
  readonly saved = output<SupplierRow>();

  name = '';
  contactPerson = '';
  phone = '';
  email = '';
  address = '';
  readonly saving = signal(false);

  constructor() {
    effect(() => {
      if (this.visible()) {
        const s = this.supplier();
        this.name = s?.name ?? '';
        this.contactPerson = s?.contactPerson ?? '';
        this.phone = s?.phone ?? '';
        this.email = s?.email ?? '';
        this.address = s?.address ?? '';
      }
    });
  }

  close(): void {
    this.closed.emit();
  }

  submit(): void {
    if (!this.name?.trim()) return;
    const payload: SupplierPayload = {
      name: this.name.trim(),
      contactPerson: this.contactPerson?.trim() || null,
      phone: this.phone?.trim() || null,
      email: this.email?.trim() || null,
      address: this.address?.trim() || null,
    };
    const id = this.supplier()?.id;

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
        this.message.error(err?.error?.message ?? 'Failed to save supplier');
      },
    });
  }
}
