import { UpperCasePipe } from '@angular/common';
import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDropDownModule } from 'ng-zorro-antd/dropdown';
import { NzMenuModule } from 'ng-zorro-antd/menu';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzProgressModule } from 'ng-zorro-antd/progress';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { TranslatePipe } from '@ngx-translate/core';
import { LucideAngularModule } from 'lucide-angular';
import {
  Building2,
  ChevronLeft,
  ChevronRight,
  KeySquare,
  MoreVertical,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Users,
} from 'lucide-angular';
import { ConfirmationService } from '../../../core/services/confirmation.service';
import { TranslateService } from '@ngx-translate/core';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { TenantFormModalComponent } from '../tenant-form-modal/tenant-form-modal.component';
import { LicenseManagementModalComponent } from '../license-management-modal/license-management-modal.component';
import type { TenantRow } from '../models/tenant.model';
import { TenantsService } from '../services/tenants.service';

@Component({
  selector: 'app-tenants-list',
  standalone: true,
  providers: [ConfirmationService],
  imports: [
    UpperCasePipe,
    FormsModule,
    NzButtonModule,
    NzDropDownModule,
    NzMenuModule,
    NzModalModule,
    NzProgressModule,
    NzTableModule,
    NzTagModule,
    TranslatePipe,
    LucideAngularModule,
    EmptyStateComponent,
    TenantFormModalComponent,
    LicenseManagementModalComponent,
  ],
  templateUrl: './tenants-list.component.html',
  styleUrl: './tenants-list.component.scss',
})
export class TenantsListComponent implements OnInit {
  private readonly api = inject(TenantsService);
  private readonly confirmation = inject(ConfirmationService);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);

  private t(key: string, params?: Record<string, string>): string {
    return this.translate.instant(key, params);
  }

  readonly lucideBuilding2 = Building2;
  readonly lucideSearch = Search;
  readonly lucideRefreshCw = RefreshCw;
  readonly lucidePlus = Plus;
  readonly lucideMoreVertical = MoreVertical;
  readonly lucideUsers = Users;
  readonly lucideChevronLeft = ChevronLeft;
  readonly lucideChevronRight = ChevronRight;
  readonly lucidePencil = Pencil;
  readonly lucideKeySquare = KeySquare;

  readonly tenants = signal<TenantRow[]>([]);
  readonly total = signal(0);
  readonly loading = signal(false);

  search = '';
  statusFilter = '';
  readonly pageIndex = signal(1);
  readonly pageSize = signal(15);
  readonly createModalOpen = signal(false);
  readonly editTenant = signal<TenantRow | null>(null);
  readonly licenseTenant = signal<TenantRow | null>(null);

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.api
      .list({
        page: this.pageIndex(),
        limit: this.pageSize(),
        search: this.search || undefined,
        status: this.statusFilter || undefined,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.tenants.set(res.data);
          this.total.set(res.total);
          this.loading.set(false);
        },
        error: () => {
          this.tenants.set([]);
          this.loading.set(false);
        },
      });
  }

  onFilterChange(): void {
    this.pageIndex.set(1);
    this.load();
  }

  onPageChange(p: number): void {
    this.pageIndex.set(p);
    this.load();
  }

  userCount(t: TenantRow): number {
    return t._count?.users ?? 0;
  }

  userPercent(t: TenantRow): number {
    const count = this.userCount(t);
    const max = t.maxUsers ?? 10;
    return max > 0 ? Math.min(100, (count / max) * 100) : 0;
  }

  statusNzColor(status: string): string {
    switch (status) {
      case 'ACTIVE':
        return 'success';
      case 'TRIAL':
        return 'processing';
      case 'EXPIRED':
      case 'SUSPENDED':
        return 'error';
      default:
        return 'default';
    }
  }

  formatDate(val: string | null): string {
    if (!val) return '—';
    return new Date(val).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  licenseEndDisplay(t: TenantRow): string {
    if (!t.licenseEndDate) return '∞ Lifetime';
    return this.formatDate(t.licenseEndDate);
  }

  onActivate(t: TenantRow): void {
    this.confirmation
      .confirm({
        title: this.t('SUPER_ADMIN.CONFIRM_ACTIVATE_TITLE'),
        message: this.t('SUPER_ADMIN.CONFIRM_ACTIVATE_MSG', { name: t.name }),
        confirmText: this.t('COMMON.CONFIRM'),
        cancelText: this.t('COMMON.CANCEL'),
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((ok: boolean) => {
        if (ok) {
          this.api.activate(t.id).subscribe({ next: () => this.load() });
        }
      });
  }

  onSuspend(t: TenantRow): void {
    this.confirmation
      .confirm({
        title: this.t('SUPER_ADMIN.CONFIRM_SUSPEND_TITLE'),
        message: this.t('SUPER_ADMIN.CONFIRM_SUSPEND_MSG', { name: t.name }),
        confirmText: this.t('COMMON.CONFIRM'),
        cancelText: this.t('COMMON.CANCEL'),
        confirmDanger: true,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((ok: boolean) => {
        if (ok) {
          this.api.suspend(t.id).subscribe({ next: () => this.load() });
        }
      });
  }

  onForceLogout(t: TenantRow): void {
    this.confirmation
      .confirm({
        title: this.t('SUPER_ADMIN.CONFIRM_FORCE_LOGOUT_TITLE'),
        message: this.t('SUPER_ADMIN.CONFIRM_FORCE_LOGOUT_MSG', { name: t.name }),
        confirmText: this.t('COMMON.CONFIRM'),
        cancelText: this.t('COMMON.CANCEL'),
        confirmDanger: true,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((ok: boolean) => {
        if (ok) {
          this.api.forceLogout(t.id).subscribe({ next: () => this.load() });
        }
      });
  }

  summaryActive(): number {
    return this.tenants().filter((x) => x.subStatus === 'ACTIVE').length;
  }

  summaryTrial(): number {
    return this.tenants().filter((x) => x.subStatus === 'TRIAL').length;
  }

  summarySuspendedExpired(): number {
    return this.tenants().filter(
      (x) => x.subStatus === 'SUSPENDED' || x.subStatus === 'EXPIRED'
    ).length;
  }

  totalPages(): number {
    return Math.ceil(this.total() / this.pageSize()) || 1;
  }

  openCreate(): void {
    this.createModalOpen.set(true);
  }

  openEdit(t: TenantRow): void {
    this.editTenant.set(t);
  }

  openLicense(t: TenantRow): void {
    this.licenseTenant.set(t);
  }

  onCreateSaved(): void {
    this.createModalOpen.set(false);
    this.load();
  }

  onEditSaved(): void {
    this.editTenant.set(null);
    this.load();
  }

  onLicenseSaved(): void {
    this.licenseTenant.set(null);
    this.load();
  }
}
