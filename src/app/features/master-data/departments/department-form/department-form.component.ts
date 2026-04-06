import { Component, effect, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { first } from 'rxjs/operators';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { DepartmentsService } from '../../services/departments.service';
import type { DepartmentPayload, DepartmentRow } from '../../models/department.model';

@Component({
  selector: 'app-department-form',
  standalone: true,
  imports: [FormsModule, NzButtonModule, NzFormModule, NzInputModule, NzModalModule, TranslatePipe],
  template: `
    <nz-modal
      [nzVisible]="visible()"
      [nzTitle]="(department() ? 'DEPARTMENTS.EDIT' : 'DEPARTMENTS.NEW') | translate"
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
                  [placeholder]="'DEPARTMENTS.NAME_PLACEHOLDER' | translate"
                  [(ngModel)]="name"
                  name="name"
                  required
                />
              </nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label [nzRequired]="true">{{ 'DEPARTMENTS.CODE' | translate }}</nz-form-label>
              <nz-form-control>
                <input
                  nz-input
                  [placeholder]="'DEPARTMENTS.CODE_PLACEHOLDER' | translate"
                  [(ngModel)]="code"
                  name="code"
                  (blur)="onCodeBlur()"
                  required
                />
                @if (codeTaken()) {
                  <div class="ant-form-item-explain-error">{{ 'DEPARTMENTS.CODE_EXISTS' | translate }}</div>
                }
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
          [disabled]="saving() || codeChecking() || codeTaken() || !name.trim() || !code.trim()"
          (click)="submit()"
        >
          {{ saving() ? ('COMMON.SAVING' | translate) : ('COMMON.SAVE' | translate) }}
        </button>
      </ng-template>
    </nz-modal>
  `,
})
export class DepartmentFormComponent {
  private readonly api = inject(DepartmentsService);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);

  readonly visible = input(false);
  readonly department = input<DepartmentRow | null>(null);
  readonly closed = output<void>();
  readonly saved = output<DepartmentRow>();

  name = '';
  code = '';
  readonly saving = signal(false);
  readonly codeChecking = signal(false);
  readonly codeTaken = signal(false);

  constructor() {
    effect(() => {
      if (this.visible()) {
        const d = this.department();
        this.name = d?.name ?? '';
        this.code = d?.code ?? '';
        this.codeTaken.set(false);
        this.codeChecking.set(false);
      }
    });
  }

  close(): void {
    this.closed.emit();
  }

  submit(): void {
    if (!this.name?.trim() || !this.code?.trim() || this.codeTaken() || this.codeChecking()) return;
    const payload: DepartmentPayload = { name: this.name.trim(), code: this.code.trim() };
    const id = this.department()?.id;

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
        this.message.error(err?.error?.message ?? this.translate.instant('DEPARTMENTS.ERROR_SAVE'));
      },
    });
  }

  onCodeBlur(): void {
    const code = this.code?.trim();
    if (!code) {
      this.codeTaken.set(false);
      return;
    }
    this.codeChecking.set(true);
    this.api
      .codeExists(code, this.department()?.id)
      .pipe(first())
      .subscribe({
        next: (exists) => {
          this.codeTaken.set(exists);
          this.codeChecking.set(false);
        },
        error: () => {
          this.codeTaken.set(false);
          this.codeChecking.set(false);
        },
      });
  }
}
