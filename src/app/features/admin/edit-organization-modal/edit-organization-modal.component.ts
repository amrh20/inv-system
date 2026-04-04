import { Component, DestroyRef, effect, inject, input, output, signal } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  FormControl,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { Subscription, firstValueFrom } from 'rxjs';
import { finalize } from 'rxjs/operators';
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
import type { TenantAdminUpdatePayload, TenantUpdatePayload } from '../services/tenants.service';
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

  /** Target user for PUT .../tenants/:id/admin/:userId (from primaryAdmin or getTenantAdmins). */
  private primaryAdminUserId: string | null = null;

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
      this.primaryAdminUserId = null;
      this.formError = '';
      this.patchFromTenant(row);
      this.detailLoading.set(true);
      const requestedId = row.id;
      this.detailSub = this.api
        .getTenantById(requestedId)
        .pipe(finalize(() => this.detailLoading.set(false)))
        .subscribe({
          next: (detail) => {
            if (!this.visible() || this.tenant()?.id !== requestedId) {
              return;
            }
            if (detail?.id) {
              this.patchFromTenant(detail);
              if (!this.primaryAdminUserId) {
                this.tryResolveAdminUserId(requestedId);
              }
            } else {
              this.patchFromTenant(row);
              this.tryResolveAdminUserId(requestedId);
            }
          },
          error: () => {
            if (!this.visible() || this.tenant()?.id !== requestedId) {
              return;
            }
            this.formError = 'SUPER_ADMIN.EDIT_ORG_LOAD_FAILED';
            this.patchFromTenant(row);
            this.tryResolveAdminUserId(requestedId);
          },
        });
    });
  }

  /** When GET detail omits primaryAdmin.id, resolve admin user id for updateTenantAdmin. */
  private tryResolveAdminUserId(tenantId: string): void {
    if (this.primaryAdminUserId) {
      return;
    }
    this.api.getTenantAdmins(tenantId).subscribe({
      next: (admins) => {
        if (!this.visible() || this.tenantId !== tenantId) {
          return;
        }
        const em = (this.form.getRawValue().manager.email ?? '').trim().toLowerCase();
        const byEmail = em
          ? admins.find((a) => (a.email ?? '').trim().toLowerCase() === em)
          : undefined;
        const hit = byEmail ?? admins[0];
        if (hit?.id) {
          this.primaryAdminUserId = hit.id;
        }
      },
      error: () => {},
    });
  }

  private resetForm(): void {
    this.primaryAdminUserId = null;
    this.baseline = null;
    this.form.reset({
      organization: { name: '', slug: '', maxBranches: 1 },
      manager: { firstName: '', lastName: '', email: '', password: '' },
    });
  }

  private patchFromTenant(t: TenantRow): void {
    const pa = t.primaryAdmin;
    const mgr = t.organizationManager;
    const email =
      pa?.email?.trim() ||
      mgr?.email?.trim() ||
      t.managerEmail?.trim() ||
      t.orgManagerEmail?.trim() ||
      t.primaryManagerEmail?.trim() ||
      '';
    const firstName = pa?.firstName?.trim() || mgr?.firstName?.trim() || '';
    const lastName = pa?.lastName?.trim() || mgr?.lastName?.trim() || '';
    if (pa?.id) {
      this.primaryAdminUserId = pa.id;
    }
    const maxBr = t.maxBranches != null && t.maxBranches >= 1 ? t.maxBranches : 1;
    this.form.patchValue({
      organization: {
        name: t.name ?? '',
        slug: t.slug ?? '',
        maxBranches: maxBr,
      },
      manager: {
        firstName,
        lastName,
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

  private buildTenantUpdatePayload(): TenantUpdatePayload | null {
    if (!this.baseline) {
      return null;
    }
    const raw = this.form.getRawValue();
    const name = (raw.organization.name ?? '').trim();
    const slug = this.normalizeSlug(raw.organization.slug ?? '');
    const maxBr = Math.max(1, Math.floor(Number(raw.organization.maxBranches) || 1));
    const bOrg = this.baseline.organization;
    const payload: TenantUpdatePayload = {};
    if (name !== bOrg.name) {
      payload.name = name;
    }
    if (slug !== bOrg.slug) {
      payload.slug = slug;
    }
    if (maxBr !== bOrg.maxBranches) {
      payload.maxBranches = maxBr;
    }
    return Object.keys(payload).length > 0 ? payload : null;
  }

  private buildAdminUpdatePayload(): TenantAdminUpdatePayload | null {
    if (!this.baseline) {
      return null;
    }
    const raw = this.form.getRawValue();
    const fn = (raw.manager.firstName ?? '').trim();
    const ln = (raw.manager.lastName ?? '').trim();
    const em = (raw.manager.email ?? '').trim();
    const pwd = (raw.manager.password ?? '').trim();
    const bMgr = this.baseline.manager;
    const payload: TenantAdminUpdatePayload = {};
    if (fn !== bMgr.firstName) {
      payload.firstName = fn;
    }
    if (ln !== bMgr.lastName) {
      payload.lastName = ln;
    }
    if (em !== bMgr.email) {
      payload.email = em;
    }
    if (pwd) {
      payload.password = pwd;
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

    const tenantPayload = this.buildTenantUpdatePayload();
    const adminPayload = this.buildAdminUpdatePayload();
    if (!tenantPayload && !adminPayload) {
      this.message.warning(this.translate.instant('SUPER_ADMIN.EDIT_ORG_NO_CHANGES'));
      return;
    }
    if (adminPayload && !this.primaryAdminUserId) {
      this.formError = 'SUPER_ADMIN.EDIT_ORG_ADMIN_ID_MISSING';
      this.message.error(this.getErrorMessage());
      return;
    }

    this.saving.set(true);
    void this.runOrganizationSave(id, tenantPayload, adminPayload);
  }

  private async runOrganizationSave(
    id: string,
    tenantPayload: TenantUpdatePayload | null,
    adminPayload: TenantAdminUpdatePayload | null,
  ): Promise<void> {
    try {
      if (tenantPayload) {
        await firstValueFrom(this.api.updateTenant(id, tenantPayload));
      }
      if (adminPayload && this.primaryAdminUserId) {
        await firstValueFrom(
          this.api.updateTenantAdmin(id, this.primaryAdminUserId, adminPayload),
        );
      }
      this.message.success(this.translate.instant('SUPER_ADMIN.EDIT_ORG_UPDATE_SUCCESS'));
      this.saved.emit();
    } catch (err: unknown) {
      this.formError = formErrorKeyFromHttp(err, 'SUPER_ADMIN.EDIT_ORG_UPDATE_FAILED');
      this.message.error(this.getErrorMessage());
    } finally {
      this.saving.set(false);
    }
  }
}
