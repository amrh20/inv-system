import { Component, effect, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzGridModule } from 'ng-zorro-antd/grid';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { LucideAngularModule } from 'lucide-angular';
import { Building2, Eye, EyeOff, KeySquare, User } from 'lucide-angular';
import type { PlanType } from '../../../core/models/enums';
import type { TenantCreatePayload } from '../services/tenants.service';
import { TenantsService } from '../services/tenants.service';

const PLAN_LIMITS: Record<string, number | null> = {
  BASIC: 5,
  PRO: 25,
  ENTERPRISE: 99999,
  CUSTOM: null as unknown as number,
};

@Component({
  selector: 'app-tenant-create-modal',
  standalone: true,
  imports: [
    FormsModule,
    NzAlertModule,
    NzButtonModule,
    NzFormModule,
    NzGridModule,
    NzInputModule,
    NzModalModule,
    NzSelectModule,
    TranslatePipe,
    LucideAngularModule,
  ],
  templateUrl: './tenant-create-modal.component.html',
  styleUrl: './tenant-create-modal.component.scss',
})
export class TenantCreateModalComponent {
  private readonly api = inject(TenantsService);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);

  readonly visible = input.required<boolean>();
  readonly saved = output<void>();

  readonly lucideBuilding2 = Building2;
  readonly lucideKeySquare = KeySquare;
  readonly lucideUser = User;
  readonly lucideEye = Eye;
  readonly lucideEyeOff = EyeOff;

  readonly saving = signal(false);
  readonly showPassword = signal(false);

  name = '';
  slug = '';
  planType: PlanType = 'BASIC';
  subStatus = 'TRIAL';
  maxUsers = 5;
  licenseStartDate = new Date().toISOString().split('T')[0];
  licenseEndDate = '';
  adminFirstName = '';
  adminLastName = '';
  adminEmail = '';
  adminPassword = '';
  formError = '';

  constructor() {
    effect(() => {
      if (this.visible()) {
        this.resetForm();
      } else {
        this.formError = '';
      }
    });
  }

  getErrorMessage(): string {
    if (!this.formError) return '';
    if (this.formError.startsWith('SUPER_ADMIN.')) {
      return this.translate.instant(this.formError);
    }
    return this.formError;
  }

  private resetForm(): void {
    this.name = '';
    this.slug = '';
    this.planType = 'BASIC';
    this.subStatus = 'TRIAL';
    this.maxUsers = 5;
    this.licenseStartDate = new Date().toISOString().split('T')[0];
    this.licenseEndDate = '';
    this.adminFirstName = '';
    this.adminLastName = '';
    this.adminEmail = '';
    this.adminPassword = '';
    this.formError = '';
  }

  onNameChange(): void {
    if (!this.name) return;
    this.slug = this.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }

  onPlanChange(plan: PlanType): void {
    this.planType = plan;
    const limit = PLAN_LIMITS[plan];
    if (limit != null) this.maxUsers = limit;
  }

  togglePasswordVisibility(): void {
    this.showPassword.update((v) => !v);
  }

  close(): void {
    this.saved.emit();
  }

  submit(): void {
    this.formError = '';
    if (!this.name?.trim() || !this.slug?.trim() || !this.adminEmail?.trim() || !this.adminPassword) {
      this.formError = 'SUPER_ADMIN.CREATE_VALIDATION';
      return;
    }
    if (this.adminPassword.length < 8) {
      this.formError = 'SUPER_ADMIN.CREATE_PASSWORD_MIN';
      return;
    }

    this.saving.set(true);
    const payload: TenantCreatePayload = {
      name: this.name.trim(),
      slug: this.slug.trim().toLowerCase().replace(/\s+/g, '-'),
      planType: this.planType,
      subStatus: this.subStatus as 'TRIAL' | 'ACTIVE',
      maxUsers: this.maxUsers,
      licenseStartDate: this.licenseStartDate || undefined,
      licenseEndDate: this.licenseEndDate || null,
      adminEmail: this.adminEmail.trim(),
      adminPassword: this.adminPassword,
      adminFirstName: this.adminFirstName?.trim() || 'Admin',
      adminLastName: this.adminLastName?.trim() || this.name.trim(),
    };

    this.api.create(payload).subscribe({
      next: () => {
        this.saving.set(false);
        this.message.success(this.translate.instant('SUPER_ADMIN.CREATE_SUCCESS'));
        this.saved.emit();
      },
      error: (err) => {
        this.formError = err.error?.message || err.message || 'SUPER_ADMIN.CREATE_FAILED';
        this.saving.set(false);
      },
    });
  }
}
