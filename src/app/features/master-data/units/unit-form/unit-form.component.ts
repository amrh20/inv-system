import { Component, effect, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { first } from 'rxjs/operators';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzGridModule } from 'ng-zorro-antd/grid';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzMessageService } from 'ng-zorro-antd/message';
import { TranslatePipe } from '@ngx-translate/core';
import { UnitsService } from '../../services/units.service';
import type { UnitPayload, UnitRow } from '../../models/unit.model';

@Component({
  selector: 'app-unit-form',
  standalone: true,
  imports: [FormsModule, NzButtonModule, NzFormModule, NzGridModule, NzInputModule, NzModalModule, TranslatePipe],
  template: `
    <nz-modal
      [nzVisible]="visible()"
      [nzTitle]="(unit() ? 'UNITS.EDIT' : 'UNITS.NEW') | translate"
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
                  [placeholder]="'UNITS.NAME_PLACEHOLDER' | translate"
                  [(ngModel)]="name"
                  name="name"
                  required
                />
              </nz-form-control>
            </nz-form-item>
            <nz-row [nzGutter]="16">
              <nz-col [nzSpan]="12">
                <nz-form-item>
                  <nz-form-label [nzRequired]="true">{{ 'UNITS.ABBREVIATION' | translate }}</nz-form-label>
                  <nz-form-control>
                    <input
                      nz-input
                      [placeholder]="'UNITS.ABBREVIATION_PLACEHOLDER' | translate"
                      [(ngModel)]="abbreviation"
                      name="abbreviation"
                      required
                    />
                  </nz-form-control>
                </nz-form-item>
              </nz-col>
              <nz-col [nzSpan]="12">
                <nz-form-item>
                  <nz-form-label>{{ 'COMMON.DESCRIPTION' | translate }}</nz-form-label>
                  <nz-form-control>
                    <input
                      nz-input
                      [placeholder]="'UNITS.DESCRIPTION_PLACEHOLDER' | translate"
                      [(ngModel)]="description"
                      name="description"
                    />
                  </nz-form-control>
                </nz-form-item>
              </nz-col>
            </nz-row>
          </form>
        }
      </ng-container>
      <ng-template #footerTpl>
        <button nz-button type="button" (click)="close()">{{ 'COMMON.CANCEL' | translate }}</button>
        <button
          nz-button
          nzType="primary"
          type="button"
          [disabled]="saving() || !name?.trim() || !abbreviation?.trim()"
          (click)="submit()"
        >
          {{ saving() ? ('COMMON.SAVING' | translate) : ('COMMON.SAVE' | translate) }}
        </button>
      </ng-template>
    </nz-modal>
  `,
})
export class UnitFormComponent {
  private readonly api = inject(UnitsService);
  private readonly message = inject(NzMessageService);

  readonly visible = input(false);
  readonly unit = input<UnitRow | null>(null);
  readonly closed = output<void>();
  readonly saved = output<UnitRow>();

  name = '';
  abbreviation = '';
  description = '';
  readonly saving = signal(false);

  constructor() {
    effect(() => {
      if (this.visible()) {
        const u = this.unit();
        this.name = u?.name ?? '';
        this.abbreviation = u?.abbreviation ?? '';
        this.description = u?.description ?? '';
      }
    });
  }

  close(): void {
    this.closed.emit();
  }

  submit(): void {
    if (!this.name?.trim() || !this.abbreviation?.trim()) return;
    const payload: UnitPayload = {
      name: this.name.trim(),
      abbreviation: this.abbreviation.trim(),
      description: this.description?.trim() || null,
    };
    const id = this.unit()?.id;

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
        this.message.error(err?.error?.message ?? 'Failed to save unit');
      },
    });
  }
}
