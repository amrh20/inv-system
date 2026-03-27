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
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { LucideAngularModule } from 'lucide-angular';
import { Building2, User } from 'lucide-angular';
import { formErrorKeyFromHttp } from '../../../core/utils/http-error.util';
import type { TenantRow } from '../models/tenant.model';
import type { TenantOrganizationManagerUpdatePayload } from '../services/tenants.service';
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
  selector: 'app-edit-organization-modal',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    NzAlertModule,
    NzButtonModule,
    NzFormModule,
    NzGridModule,
    NzInputModule,
    NzInputNumberModule,
    NzModalModule,
    NzSpinModule,
    TranslatePipe,
    LucideAngularModule,
  ],
  templateUrl: './edit-organization-modal.component.html',
  styleUrl: './edit-organization-modal.component.scss',
})
export class EditOrganizationModalComponent {
  private readonly api = inject(TenantsService);
  private readonly fb = inject(FormBuilder);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);

  readonly visible = input.required<boolean>();
  readonly tenant = input<TenantRow | null>(null);
  readonly saved = output<void>();
  readonly cancelled = output<void>();

  readonly lucideBuilding2 = Building2;
  readonly lucideUser = User;

  readonly detailLoading = signal(false);
  readonly saving = signal(false);
  formError = '';

  private detailSub: Subscription | undefined;

  readonly form = this.fb.group({
    organization: this.fb.group({
      name: ['', Validators.required],
      slug: ['', Validators.required],
      maxBranches: [1, [Validators.required, Validators.min(1)]],
    }),
    manager: this.fb.group({
      firstName: [''],
      lastName: [''],
      email: ['', optionalEmail()],
      password: ['', optionalPasswordMinLength(8)],
    }),
  });

  private tenantId: string | null = null;

  /** Values last loaded from the server (for partial PATCH + placeholders when inputs are empty). */
  private baseline: {
    organization: { name: string; slug: string; maxBranches: number };
    manager: { firstName: string; lastName: string; email: string };
  } | null = null;

  constructor() {
    effect(() => {
      const vis = this.visible();
      const row = this.tenant();
      this.detailSub?.unsubscribe();
      this.detailSub = undefined;

      if (!vis) {
        this.formError = '';
        this.tenantId = null;
        this.resetForm();
        return;
      }

      if (!row?.id) {
        return;
      }

      this.tenantId = row.id;
      this.formError = '';
      this.patchFromTenant(row);
      this.detailLoading.set(true);
      const requestedId = row.id;
      this.detailSub = this.api
        .getById(requestedId)
        .pipe(finalize(() => this.detailLoading.set(false)))
        .subscribe({
          next: (detail) => {
            if (!this.visible() || this.tenant()?.id !== requestedId) {
              return;
            }
            if (detail) {
              this.patchFromTenant(detail);
            } else {
              this.patchFromTenant(row);
            }
          },
          error: () => {
            if (!this.visible() || this.tenant()?.id !== requestedId) {
              return;
            }
            this.formError = 'SUPER_ADMIN.EDIT_ORG_LOAD_FAILED';
            this.patchFromTenant(row);
          },
        });
    });
  }

  private resetForm(): void {
    this.baseline = null;
    this.form.reset({
      organization: { name: '', slug: '', maxBranches: 1 },
      manager: { firstName: '', lastName: '', email: '', password: '' },
    });
  }

  private patchFromTenant(t: TenantRow): void {
    const mgr = t.organizationManager;
    const email =
      mgr?.email?.trim() ||
      t.managerEmail?.trim() ||
      t.orgManagerEmail?.trim() ||
      t.primaryManagerEmail?.trim() ||
      '';
    const maxBr = t.maxBranches != null && t.maxBranches >= 1 ? t.maxBranches : 1;
    this.form.patchValue({
      organization: {
        name: t.name ?? '',
        slug: t.slug ?? '',
        maxBranches: maxBr,
      },
      manager: {
        firstName: mgr?.firstName?.trim() ?? '',
        lastName: mgr?.lastName?.trim() ?? '',
        email,
        password: '',
      },
    });
    this.form.get('manager.password')?.updateValueAndValidity({ emitEvent: false });
    this.captureBaseline();
  }

  private normalizeSlug(raw: string): string {
    return raw.trim().toLowerCase().replace(/\s+/g, '-');
  }

  private captureBaseline(): void {
    const v = this.form.getRawValue();
    this.baseline = {
      organization: {
        name: (v.organization.name ?? '').trim(),
        slug: this.normalizeSlug(v.organization.slug ?? ''),
        maxBranches: Math.max(1, Math.floor(Number(v.organization.maxBranches) || 1)),
      },
      manager: {
        firstName: (v.manager.firstName ?? '').trim(),
        lastName: (v.manager.lastName ?? '').trim(),
        email: (v.manager.email ?? '').trim(),
      },
    };
  }

  /** Placeholder when the control is empty: show saved value if any, else translated hint. */
  orgNamePlaceholder(): string {
    const b = this.baseline?.organization.name;
    return b || this.translate.instant('SUPER_ADMIN.WIZARD_ORG_NAME_PLACEHOLDER');
  }

  orgSlugPlaceholder(): string {
    const b = this.baseline?.organization.slug;
    return b || this.translate.instant('SUPER_ADMIN.CREATE_SLUG_PLACEHOLDER');
  }

  managerFirstNamePlaceholder(): string {
    const b = this.baseline?.manager.firstName;
    return b || this.translate.instant('SUPER_ADMIN.CREATE_ADMIN_FIRST_PLACEHOLDER');
  }

  managerLastNamePlaceholder(): string {
    const b = this.baseline?.manager.lastName;
    return b || this.translate.instant('SUPER_ADMIN.CREATE_ADMIN_LAST_PLACEHOLDER');
  }

  managerEmailPlaceholder(): string {
    const b = this.baseline?.manager.email;
    return b || this.translate.instant('SUPER_ADMIN.CREATE_ADMIN_EMAIL_PLACEHOLDER');
  }

  private buildPartialPayload(): TenantOrganizationManagerUpdatePayload | null {
    if (!this.baseline) {
      return null;
    }

    const raw = this.form.getRawValue();
    const org: Partial<{ name: string; slug: string; maxBranches: number }> = {};
    const name = (raw.organization.name ?? '').trim();
    const slug = this.normalizeSlug(raw.organization.slug ?? '');
    const maxBr = Math.max(1, Math.floor(Number(raw.organization.maxBranches) || 1));
    const bOrg = this.baseline.organization;

    if (name !== bOrg.name) {
      org.name = name;
    }
    if (slug !== bOrg.slug) {
      org.slug = slug;
    }
    if (maxBr !== bOrg.maxBranches) {
      org.maxBranches = maxBr;
    }

    const mgr: Partial<{
      firstName: string;
      lastName: string;
      email: string;
      password: string;
    }> = {};
    const fn = (raw.manager.firstName ?? '').trim();
    const ln = (raw.manager.lastName ?? '').trim();
    const em = (raw.manager.email ?? '').trim();
    const pwd = (raw.manager.password ?? '').trim();
    const bMgr = this.baseline.manager;

    if (fn !== bMgr.firstName) {
      mgr.firstName = fn;
    }
    if (ln !== bMgr.lastName) {
      mgr.lastName = ln;
    }
    if (em !== bMgr.email) {
      mgr.email = em;
    }
    if (pwd) {
      mgr.password = pwd;
    }

    const payload: TenantOrganizationManagerUpdatePayload = {};
    if (Object.keys(org).length > 0) {
      payload.organization = org;
    }
    if (Object.keys(mgr).length > 0) {
      payload.manager = mgr;
    }

    return Object.keys(payload).length > 0 ? payload : null;
  }

  getErrorMessage(): string {
    if (!this.formError) return '';
    if (this.formError.startsWith('SUPER_ADMIN.')) {
      return this.translate.instant(this.formError);
    }
    return this.formError;
  }

  get modalTitle(): string {
    return this.translate.instant('SUPER_ADMIN.EDIT_ORGANIZATION_TITLE');
  }

  dismiss(): void {
    this.cancelled.emit();
  }

  submit(): void {
    this.formError = '';
    this.form.get('organization')?.markAllAsTouched();
    this.form.get('manager')?.markAllAsTouched();
    if (this.form.get('organization')?.invalid || this.form.get('manager')?.invalid) {
      return;
    }

    const id = this.tenantId;
    if (!id) {
      return;
    }

    const payload = this.buildPartialPayload();
    if (!payload) {
      this.message.warning(this.translate.instant('SUPER_ADMIN.EDIT_ORG_NO_CHANGES'));
      return;
    }

    this.saving.set(true);
    this.api
      .updateOrganizationAndManager(id, payload)
      .pipe(
        finalize(() => this.saving.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => {
          this.message.success(this.translate.instant('SUPER_ADMIN.EDIT_ORG_UPDATE_SUCCESS'));
          this.saved.emit();
        },
        error: (err) => {
          this.formError = formErrorKeyFromHttp(err, 'SUPER_ADMIN.EDIT_ORG_UPDATE_FAILED');
          this.message.error(this.getErrorMessage());
        },
      });
  }
}
