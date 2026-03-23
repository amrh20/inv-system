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
import { KeySquare } from 'lucide-angular';
import type { TenantLicenseUpdatePayload } from '../services/tenants.service';
import { TenantsService } from '../services/tenants.service';
import type { TenantRow } from '../models/tenant.model';

@Component({
  selector: 'app-license-management-modal',
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
  templateUrl: './license-management-modal.component.html',
  styleUrl: './license-management-modal.component.scss',
})
export class LicenseManagementModalComponent {
  private readonly api = inject(TenantsService);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);

  readonly visible = input.required<boolean>();
  readonly tenant = input<TenantRow | null>(null);
  readonly saved = output<void>();

  readonly lucideKeySquare = KeySquare;

  readonly saving = signal(false);
  formError = '';

  licenseStartDate = '';
  licenseEndDate = '';
  subStatus = 'ACTIVE';

  private tenantId: string | null = null;
  private tenantName = '';

  constructor() {
    effect(() => {
      if (this.visible()) {
        const t = this.tenant();
        if (t) {
          this.tenantId = t.id;
          this.tenantName = t.name ?? '';
          this.licenseStartDate = t.licenseStartDate
            ? new Date(t.licenseStartDate).toISOString().split('T')[0]
            : new Date().toISOString().split('T')[0];
          this.licenseEndDate = t.licenseEndDate
            ? new Date(t.licenseEndDate).toISOString().split('T')[0]
            : '';
          this.subStatus = t.subStatus ?? 'ACTIVE';
        }
      } else {
        this.formError = '';
        this.tenantId = null;
      }
    });
  }

  get modalTitle(): string {
    return this.translate.instant('SUPER_ADMIN.MANAGE_LICENSE_TITLE', { name: this.tenantName });
  }

  getErrorMessage(): string {
    if (!this.formError) return '';
    if (this.formError.startsWith('SUPER_ADMIN.')) {
      return this.translate.instant(this.formError);
    }
    return this.formError;
  }

  close(): void {
    this.saved.emit();
  }

  submit(): void {
    this.formError = '';
    if (!this.tenantId || !this.licenseStartDate?.trim()) {
      this.formError = 'SUPER_ADMIN.LICENSE_VALIDATION';
      return;
    }

    const payload: TenantLicenseUpdatePayload = {
      licenseStartDate: this.licenseStartDate,
      licenseEndDate: this.licenseEndDate || null,
      subStatus: this.subStatus,
    };

    this.saving.set(true);
    this.api.updateLicense(this.tenantId, payload).subscribe({
      next: () => {
        this.saving.set(false);
        this.message.success(this.translate.instant('SUPER_ADMIN.LICENSE_UPDATE_SUCCESS'));
        this.saved.emit();
      },
      error: (err) => {
        this.formError = err.error?.message || err.message || 'SUPER_ADMIN.LICENSE_UPDATE_FAILED';
        this.saving.set(false);
      },
    });
  }
}
