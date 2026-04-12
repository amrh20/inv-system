import { DatePipe, DecimalPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, FormControl, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { catchError, EMPTY, filter, first, switchMap } from 'rxjs';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule, NzModalService } from 'ng-zorro-antd/modal';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { LucideAngularModule } from 'lucide-angular';
import { Lock, Loader2, Package, Save, Settings, User as LucideUser } from 'lucide-angular';
import { ConfirmationService } from '../../../../core/services/confirmation.service';
import { AuthService } from '../../../../core/services/auth.service';
import type { User } from '../../../../core/models';
import type { UserRole } from '../../../../core/models/enums';
import { environment } from '../../../../../environments/environment';
import type {
  InventoryStatusResponse,
  ObFinalizeValidationDetails,
} from '../../models/admin.models';
import type { DepartmentRow } from '../../../master-data/models/department.model';
import { DepartmentsService } from '../../../master-data/services/departments.service';
import { AppSettingsService } from '../../services/app-settings.service';
import { UsersAdminService } from '../../services/users-admin.service';

@Component({
  selector: 'app-settings-page',
  standalone: true,
  providers: [ConfirmationService],
  imports: [
    DatePipe,
    DecimalPipe,
    FormsModule,
    ReactiveFormsModule,
    NzAlertModule,
    NzButtonModule,
    NzCardModule,
    NzInputModule,
    NzModalModule,
    NzSelectModule,
    NzSpinModule,
    NzSwitchModule,
    NzTabsModule,
    TranslatePipe,
    LucideAngularModule,
    RouterLink,
  ],
  templateUrl: './settings-page.component.html',
  styleUrl: './settings-page.component.scss',
})
export class SettingsPageComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  private readonly auth = inject(AuthService);
  private readonly usersApi = inject(UsersAdminService);
  private readonly departmentsApi = inject(DepartmentsService);
  private readonly settingsApi = inject(AppSettingsService);
  private readonly message = inject(NzMessageService);
  private readonly modal = inject(NzModalService);
  private readonly translate = inject(TranslateService);
  private readonly confirmation = inject(ConfirmationService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);

  readonly lucideSettings = Settings;
  readonly lucideUser = LucideUser;
  readonly lucideSave = Save;
  readonly lucidePackage = Package;
  readonly lucideLock = Lock;
  readonly lucideLoader = Loader2;

  profileFirstName = '';
  profileLastName = '';
  profilePhone = '';

  readonly departments = signal<DepartmentRow[]>([]);
  readonly profileDepartmentIdCtrl = new FormControl<string>('', { nonNullable: true });

  readonly passwordForm = this.fb.nonNullable.group({
    currentPassword: ['', Validators.required],
    newPassword: ['', [Validators.required, Validators.minLength(8)]],
    confirmPassword: ['', Validators.required],
  });

  profileLoading = signal(false);
  profileSaving = signal(false);
  profileSuccess = signal(false);
  profileError = signal('');

  passwordSaving = signal(false);
  passwordSuccess = signal(false);
  passwordError = signal('');

  /** Full inventory / OB status from GET /settings/inventory-status. */
  obStatus = signal<InventoryStatusResponse | null>(null);
  obLoading = signal(true);
  obLockModalOpen = signal(false);
  obLockReason = signal('');
  obSaving = signal(false);
  obSuccess = signal(false);
  obError = signal('');
  obFinalizeLoading = signal(false);
  obFinalizeValidation = signal<ObFinalizeValidationDetails | null>(null);
  celebrateFinalize = signal(false);

  /** Vertical nav on ≥768px; horizontal scrollable tabs on smaller viewports. */
  readonly settingsTabPosition = signal<'left' | 'top'>('top');

  readonly envLabel = signal(
    environment.production ? 'SETTINGS.ENV_PRODUCTION' : 'SETTINGS.ENV_DEVELOPMENT',
  );

  /** Roles allowed to toggle OB (matches PATCH /inventory/status guards). */
  readonly isOpeningBalanceSwitchRole = computed(() => {
    const r = this.normalizedUserRole();
    return r === 'ADMIN' || r === 'SUPER_ADMIN' || r === 'ORG_MANAGER';
  });

  readonly obSwitchDisabled = computed(() => {
    const s = this.obStatus();
    return (
      !this.isOpeningBalanceSwitchRole() ||
      this.obLoading() ||
      this.obSaving() ||
      !!s?.lockedAt
    );
  });

  ngOnInit(): void {
    this.loadDepartments();
    this.loadProfileFromApi();
    this.loadOb();
    this.bindSettingsTabLayoutMediaQuery();
  }

  private loadDepartments(): void {
    this.departmentsApi
      .list({ slim: true, isActive: true })
      .pipe(first())
      .subscribe({
        next: (res) => {
          this.departments.set(res.departments ?? []);
          this.syncProfileDepartmentFromUser();
        },
        error: () => this.departments.set([]),
      });
  }

  /** Binds department select to profile `departmentId` or legacy `department` name/code. */
  private syncProfileDepartmentFromUser(user?: User): void {
    const u = user ?? this.auth.currentUser();
    if (!u) return;
    const depts = this.departments();
    let id = (u.departmentId ?? '').trim();
    if (!id && u.department?.trim() && depts.length > 0) {
      const needle = u.department.trim().toLowerCase();
      const byName = depts.find((d) => d.name.trim().toLowerCase() === needle);
      if (byName) {
        id = byName.id;
      } else {
        const byCode = depts.find((d) => (d.code ?? '').trim().toLowerCase() === needle);
        if (byCode) id = byCode.id;
      }
    }
    this.profileDepartmentIdCtrl.setValue(id, { emitEvent: false });
  }

  private bindSettingsTabLayoutMediaQuery(): void {
    if (typeof globalThis.matchMedia !== 'function') {
      this.settingsTabPosition.set('top');
      return;
    }
    const mql = globalThis.matchMedia('(min-width: 768px)');
    const apply = (): void => {
      this.settingsTabPosition.set(mql.matches ? 'left' : 'top');
    };
    apply();
    mql.addEventListener('change', apply);
    this.destroyRef.onDestroy(() => mql.removeEventListener('change', apply));
  }

  private loadProfileFromApi(): void {
    this.profileLoading.set(true);
    this.auth
      .getProfile()
      .pipe(first())
      .subscribe({
        next: (user) => {
          this.patchProfileForm(user);
          this.profileLoading.set(false);
        },
        error: () => {
          this.profileLoading.set(false);
          this.hydrateProfileFromUser();
        },
      });
  }

  private hydrateProfileFromUser(): void {
    const u = this.auth.currentUser();
    if (!u) return;
    this.patchProfileForm(u);
  }

  private patchProfileForm(u: User): void {
    this.profileFirstName = u.firstName ?? '';
    this.profileLastName = u.lastName ?? '';
    this.profilePhone = u.phone ?? '';
    this.syncProfileDepartmentFromUser(u);
  }

  t(key: string): string {
    return this.translate.instant(key);
  }

  role(): UserRole | undefined {
    return this.auth.currentUser()?.role;
  }

  private normalizedUserRole(): string {
    const raw = this.role() ?? '';
    const u = String(raw).toUpperCase();
    return u === 'SECURITY_MANAGER' ? 'SECURITY' : u;
  }

  isDeptManager(): boolean {
    return this.role() === 'DEPT_MANAGER';
  }

  isAdmin(): boolean {
    return this.auth.hasPermission('SETTINGS_MANAGE');
  }

  isSuperAdmin(): boolean {
    return this.auth.hasPermission('SETTINGS_OPENING_BALANCE_TOGGLE');
  }

  /** Opening Balance controls (switch context, finalize, validation alerts). */
  canManageOb(): boolean {
    if (this.isOpeningBalanceSwitchRole()) {
      return true;
    }
    return this.auth.hasPermission('SETTINGS_OPENING_BALANCE_TOGGLE');
  }

  userEmail(): string {
    return this.auth.currentUser()?.email ?? '';
  }

  tenantLabel(): string {
    const u = this.auth.currentUser();
    return u?.tenant?.name ?? u?.tenantId?.slice(0, 12) ?? '—';
  }

  userIdShort(): string {
    const id = this.auth.currentUser()?.id;
    return id ? `${id.slice(0, 12)}…` : '—';
  }

  loadOb(): void {
    this.obLoading.set(true);
    this.settingsApi
      .getInventoryStatus()
      .pipe(first())
      .subscribe({
        next: (s) => {
          this.obStatus.set(s);
          this.obLoading.set(false);
        },
        error: () => {
          this.obStatus.set(null);
          this.obLoading.set(false);
        },
      });
  }

  saveProfile(): void {
    const u = this.auth.currentUser();
    if (!u) return;
    this.profileSaving.set(true);
    this.profileError.set('');
    this.profileSuccess.set(false);

    const body: Record<string, unknown> = {
      firstName: this.profileFirstName.trim(),
      lastName: this.profileLastName.trim(),
      phone: this.profilePhone.trim() || undefined,
    };
    if (this.isDeptManager()) {
      const deptId = this.profileDepartmentIdCtrl.value.trim();
      if (!deptId) {
        this.profileSaving.set(false);
        this.profileError.set(this.t('USERS.ERRORS.DEPARTMENT_REQUIRED'));
        return;
      }
      body['departmentId'] = deptId;
    }

    this.usersApi
      .putUser(u.id, body)
      .pipe(first())
      .subscribe({
        next: (updated) => {
          this.profileSaving.set(false);
          this.profileSuccess.set(true);
          this.message.success(this.t('SETTINGS.MSG_PROFILE_SAVED'));
          this.auth
            .getProfile()
            .pipe(first())
            .subscribe({
              next: (user) => this.patchProfileForm(user),
              error: () => {
                this.patchProfileForm({
                  ...u,
                  firstName: updated.firstName,
                  lastName: updated.lastName,
                  email: updated.email,
                  phone: updated.phone ?? null,
                  department: updated.department ?? null,
                  departmentId: updated.departmentId ?? null,
                  role: updated.role,
                });
                this.auth.mergeSessionUserProfile({
                  firstName: updated.firstName,
                  lastName: updated.lastName,
                  email: updated.email,
                  phone: updated.phone ?? null,
                  department: updated.department ?? null,
                  departmentId: updated.departmentId ?? null,
                  role: updated.role,
                });
              },
            });
          setTimeout(() => this.profileSuccess.set(false), 3000);
        },
        error: (err: { error?: { message?: string }; message?: string }) => {
          this.profileSaving.set(false);
          this.profileError.set(err?.error?.message ?? err?.message ?? this.t('SETTINGS.ERR_PROFILE'));
        },
      });
  }

  changePassword(): void {
    const u = this.auth.currentUser();
    if (!u) return;
    this.passwordError.set('');
    if (this.passwordForm.invalid) {
      this.passwordForm.markAllAsTouched();
      return;
    }
    const { currentPassword, newPassword, confirmPassword } = this.passwordForm.getRawValue();
    if (newPassword !== confirmPassword) {
      this.passwordError.set(this.t('SETTINGS.ERR_PASSWORD_MATCH'));
      return;
    }
    if (currentPassword === newPassword) {
      this.passwordError.set(this.t('SETTINGS.ERR_PASSWORD_UNCHANGED'));
      return;
    }
    this.passwordSaving.set(true);
    this.passwordSuccess.set(false);
    this.usersApi
      .putUser(u.id, {
        currentPassword,
        password: newPassword,
      })
      .pipe(first())
      .subscribe({
        next: () => {
          this.passwordSaving.set(false);
          this.passwordSuccess.set(true);
          this.passwordForm.reset({
            currentPassword: '',
            newPassword: '',
            confirmPassword: '',
          });
          this.message.success(this.t('SETTINGS.MSG_PASSWORD_SAVED'));
          setTimeout(() => this.passwordSuccess.set(false), 3000);
        },
        error: (err: HttpErrorResponse) => {
          this.passwordSaving.set(false);
          const body = err.error as { code?: string; message?: string } | undefined;
          const code = body?.code;
          let msg: string;
          if (code === 'CURRENT_PASSWORD_REQUIRED') {
            msg = this.t('SETTINGS.ERR_CURRENT_PASSWORD_REQUIRED');
          } else if (code === 'CURRENT_PASSWORD_INCORRECT' || code === 'INVALID_CURRENT_PASSWORD') {
            msg = this.t('SETTINGS.ERR_WRONG_CURRENT_PASSWORD');
          } else if (code === 'PASSWORD_UNCHANGED') {
            msg = this.t('SETTINGS.ERR_PASSWORD_UNCHANGED');
          } else {
            msg = body?.message ?? err.message ?? this.t('SETTINGS.ERR_PASSWORD');
          }
          this.passwordError.set(msg);
        },
      });
  }

  onObSwitchClick(): void {
    if (this.obSwitchDisabled() || this.obFinalizeLoading()) {
      return;
    }
    this.obError.set('');
    if (this.obStatus()?.isOpeningBalanceAllowed !== true) {
      this.confirmEnableOb();
      return;
    }
    this.obLockReason.set('');
    this.obLockModalOpen.set(true);
  }

  closeObLockModal(): void {
    if (this.obSaving()) {
      return;
    }
    this.obLockModalOpen.set(false);
    this.obLockReason.set('');
  }

  confirmObLock(): void {
    const reason = this.obLockReason().trim();
    if (!reason) {
      this.obError.set(this.t('SETTINGS.OB_ERR_LOCK'));
      return;
    }
    this.obSaving.set(true);
    this.obError.set('');
    this.obSuccess.set(false);
    this.settingsApi
      .obLock(reason)
      .pipe(first())
      .subscribe({
        next: () => {
          this.obSaving.set(false);
          this.obLockModalOpen.set(false);
          this.obLockReason.set('');
          this.obSuccess.set(true);
          this.message.success(this.t('SETTINGS.MSG_OB_SAVED'));
          this.loadOb();
          setTimeout(() => this.obSuccess.set(false), 3000);
        },
        error: (err: { error?: { message?: string; reason?: string }; message?: string }) => {
          this.obSaving.set(false);
          this.obError.set(this.extractObError(err));
        },
      });
  }

  requestFinalizeOpeningBalance(): void {
    const s = this.obStatus();
    if (
      !this.canManageOb() ||
      s?.isOpeningBalanceAllowed !== true ||
      this.obFinalizeLoading() ||
      this.obLoading() ||
      !!s?.snapshotSummary
    ) {
      return;
    }
    this.obFinalizeValidation.set(null);
    this.obError.set('');
    this.confirmation
      .confirm({
        title: this.t('SETTINGS.OB_FINALIZE_CONFIRM_TITLE'),
        message: this.t('SETTINGS.OB_FINALIZE_CONFIRM_MESSAGE'),
        confirmText: this.t('SETTINGS.OB_FINALIZE_CONFIRM_OK'),
        cancelText: this.t('COMMON.CANCEL'),
        confirmDanger: true,
      })
      .pipe(
        first(),
        filter(Boolean),
        switchMap(() => {
          this.obFinalizeLoading.set(true);
          return this.settingsApi.obFinalize().pipe(
            catchError((err: HttpErrorResponse) => {
              this.obFinalizeLoading.set(false);
              const body = err.error as {
                code?: string;
                message?: string;
                details?: ObFinalizeValidationDetails;
              };
              if (
                err.status === 400 &&
                body?.code === 'OB_FINALIZE_VALIDATION_FAILED' &&
                body.details
              ) {
                this.obFinalizeValidation.set(body.details);
              } else {
                this.obError.set(
                  body?.message ?? err.message ?? this.t('SETTINGS.ERR_OB_FINALIZE'),
                );
              }
              return EMPTY;
            }),
          );
        }),
        first(),
      )
      .subscribe({
        next: () => {
          this.obFinalizeLoading.set(false);
          this.message.success(this.t('SETTINGS.MSG_OB_FINALIZE_SUCCESS'));
          this.celebrateFinalize.set(true);
          setTimeout(() => this.celebrateFinalize.set(false), 4500);
          this.loadOb();
        },
      });
  }

  openItemEdit(itemId: string): void {
    if (!itemId) return;
    void this.router.navigate(['/items', itemId, 'edit']);
  }

  private confirmEnableOb(): void {
    this.modal.confirm({
      nzTitle: this.t('SETTINGS.OB_ENABLE_CONFIRM_TITLE'),
      nzContent: this.t('SETTINGS.OB_ENABLE_CONFIRM_MESSAGE'),
      nzOkText: this.t('SETTINGS.OB_ENABLE_CONFIRM_OK'),
      nzCancelText: this.t('COMMON.CANCEL'),
      nzOnOk: () =>
        new Promise<void>((resolve, reject) => {
          this.obSaving.set(true);
          this.obError.set('');
          this.obSuccess.set(false);
          this.settingsApi
            .patchInventoryStatus({ isOpeningBalanceAllowed: true })
            .pipe(first())
            .subscribe({
              next: (data) => {
                this.obStatus.set(data);
                this.obSaving.set(false);
                this.obSuccess.set(true);
                this.message.success(this.t('SETTINGS.MSG_OB_SAVED'));
                this.loadOb();
                setTimeout(() => this.obSuccess.set(false), 3000);
                resolve();
              },
              error: (err: { error?: { message?: string; reason?: string }; message?: string }) => {
                this.obSaving.set(false);
                this.obError.set(this.extractObError(err));
                reject(new Error('enable failed'));
              },
            });
        }),
      nzMaskClosable: false,
    });
  }

  private extractObError(err: { error?: { message?: string; reason?: string }; message?: string }): string {
    return err?.error?.reason ?? err?.error?.message ?? err?.message ?? this.t('SETTINGS.ERR_OB');
  }
}
