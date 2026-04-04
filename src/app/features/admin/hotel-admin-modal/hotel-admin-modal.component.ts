import { Component, DestroyRef, effect, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  FormBuilder,
  FormControl,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { Subscription, finalize } from 'rxjs';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzGridModule } from 'ng-zorro-antd/grid';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { LucideAngularModule } from 'lucide-angular';
import { User } from 'lucide-angular';
import { formErrorKeyFromHttp } from '../../../core/utils/http-error.util';
import type { TenantRow } from '../models/tenant.model';
import type { TenantAdminUpdatePayload } from '../services/tenants.service';
import { TenantsService } from '../services/tenants.service';

function optionalPasswordMinLength(min: number): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const v = String(control.value ?? '').trim();
    if (!v) {
      return null;
    }
    return v.length >= min ? null : { passwordMin: { min } };
  };
}

function optionalEmail(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const v = String(control.value ?? '').trim();
    if (!v) {
      return null;
    }
    return Validators.email(new FormControl(v));
  };
}

@Component({
  selector: 'app-hotel-admin-modal',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    NzAlertModule,
    NzButtonModule,
    NzFormModule,
    NzGridModule,
    NzInputModule,
    NzModalModule,
    NzSpinModule,
    TranslatePipe,
    LucideAngularModule,
  ],
  templateUrl: './hotel-admin-modal.component.html',
  styleUrl: './hotel-admin-modal.component.scss',
})
export class HotelAdminModalComponent {
  private readonly api = inject(TenantsService);
  private readonly fb = inject(FormBuilder);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);

  readonly visible = input.required<boolean>();
  readonly tenant = input<TenantRow | null>(null);
  readonly saved = output<void>();
  readonly cancelled = output<void>();

  readonly lucideUser = User;

  readonly detailLoading = signal(false);
  readonly saving = signal(false);
  formError = '';

  private loadSub: Subscription | undefined;
  private tenantId: string | null = null;
  private adminUserId: string | null = null;

  readonly form = this.fb.group({
    firstName: [''],
    lastName: [''],
    email: ['', [Validators.required, optionalEmail()]],
    password: ['', optionalPasswordMinLength(8)],
  });

  constructor() {
    effect(() => {
      const vis = this.visible();
      const row = this.tenant();
      this.loadSub?.unsubscribe();
      this.loadSub = undefined;

      if (!vis) {
        this.formError = '';
        this.tenantId = null;
        this.adminUserId = null;
        this.form.reset({ firstName: '', lastName: '', email: '', password: '' });
        return;
      }

      if (!row?.id) {
        return;
      }

      this.tenantId = row.id;
      this.formError = '';
      this.adminUserId = null;
      this.form.reset({ firstName: '', lastName: '', email: '', password: '' });
      this.detailLoading.set(true);
      const requestedId = row.id;
      this.loadSub = this.api
        .getTenantAdmins(requestedId)
        .pipe(finalize(() => this.detailLoading.set(false)))
        .subscribe({
          next: (admins) => {
            if (!this.visible() || this.tenant()?.id !== requestedId) {
              return;
            }
            const admin = admins[0];
            if (!admin?.id) {
              this.formError = 'SUPER_ADMIN.MANAGE_ADMIN_EMPTY';
              return;
            }
            this.adminUserId = admin.id;
            this.form.patchValue({
              firstName: admin.firstName ?? '',
              lastName: admin.lastName ?? '',
              email: admin.email ?? '',
              password: '',
            });
            this.form.get('password')?.updateValueAndValidity({ emitEvent: false });
          },
          error: () => {
            if (!this.visible() || this.tenant()?.id !== requestedId) {
              return;
            }
            this.formError = 'SUPER_ADMIN.MANAGE_ADMIN_LOAD_FAILED';
          },
        });
    });
  }

  getErrorMessage(): string {
    if (!this.formError) {
      return '';
    }
    if (this.formError.startsWith('SUPER_ADMIN.')) {
      return this.translate.instant(this.formError);
    }
    return this.formError;
  }

  get modalTitle(): string {
    return this.translate.instant('SUPER_ADMIN.MANAGE_ADMIN_TITLE');
  }

  dismiss(): void {
    this.cancelled.emit();
  }

  submit(): void {
    this.formError = '';
    this.form.markAllAsTouched();
    if (this.form.invalid) {
      return;
    }
    const tid = this.tenantId;
    const uid = this.adminUserId;
    if (!tid || !uid) {
      this.formError = 'SUPER_ADMIN.MANAGE_ADMIN_NO_ADMIN';
      this.message.error(this.getErrorMessage());
      return;
    }

    const raw = this.form.getRawValue();
    const payload: TenantAdminUpdatePayload = {
      firstName: (raw.firstName ?? '').trim(),
      lastName: (raw.lastName ?? '').trim(),
      email: (raw.email ?? '').trim(),
    };
    const pwd = (raw.password ?? '').trim();
    if (pwd) {
      payload.password = pwd;
    }

    this.saving.set(true);
    this.api
      .updateTenantAdmin(tid, uid, payload)
      .pipe(
        finalize(() => this.saving.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => {
          this.message.success(this.translate.instant('SUPER_ADMIN.MANAGE_ADMIN_SUCCESS'));
          this.saved.emit();
        },
        error: (err) => {
          this.formError = formErrorKeyFromHttp(err, 'SUPER_ADMIN.MANAGE_ADMIN_FAILED');
          this.message.error(this.getErrorMessage());
        },
      });
  }
}
