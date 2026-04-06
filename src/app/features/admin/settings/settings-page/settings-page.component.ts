import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule, NzModalService } from 'ng-zorro-antd/modal';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { LucideAngularModule } from 'lucide-angular';
import { Building, Lock, Loader2, Package, Save, Settings, Unlock, User } from 'lucide-angular';
import { first } from 'rxjs';
import { AuthService } from '../../../../core/services/auth.service';
import type { UserRole } from '../../../../core/models/enums';
import { environment } from '../../../../../environments/environment';
import type { OpeningBalanceSetting } from '../../models/admin.models';
import { AppSettingsService } from '../../services/app-settings.service';
import { UsersAdminService } from '../../services/users-admin.service';

@Component({
  selector: 'app-settings-page',
  standalone: true,
  imports: [
    FormsModule,
    NzAlertModule,
    NzButtonModule,
    NzInputModule,
    NzModalModule,
    NzSpinModule,
    NzSwitchModule,
    TranslatePipe,
    LucideAngularModule,
  ],
  templateUrl: './settings-page.component.html',
  styleUrl: './settings-page.component.scss',
})
export class SettingsPageComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly usersApi = inject(UsersAdminService);
  private readonly settingsApi = inject(AppSettingsService);
  private readonly message = inject(NzMessageService);
  private readonly modal = inject(NzModalService);
  private readonly translate = inject(TranslateService);

  readonly lucideSettings = Settings;
  readonly lucideUser = User;
  readonly lucideBuilding = Building;
  readonly lucideSave = Save;
  readonly lucidePackage = Package;
  readonly lucideLock = Lock;
  readonly lucideUnlock = Unlock;
  readonly lucideLoader = Loader2;

  profileFirstName = '';
  profileLastName = '';
  profilePhone = '';
  profileDepartment = '';

  passwordNew = '';
  passwordConfirm = '';

  profileSaving = signal(false);
  profileSuccess = signal(false);
  profileError = signal('');

  passwordSaving = signal(false);
  passwordSuccess = signal(false);
  passwordError = signal('');

  obStatus = signal<OpeningBalanceSetting | null>(null);
  obLoading = signal(true);
  obLockModalOpen = signal(false);
  obLockReason = signal('');
  obSaving = signal(false);
  obSuccess = signal(false);
  obError = signal('');

  readonly envLabel = signal(
    environment.production ? 'SETTINGS.ENV_PRODUCTION' : 'SETTINGS.ENV_DEVELOPMENT',
  );

  ngOnInit(): void {
    this.hydrateProfileFromUser();
    this.auth.currentUser();
    this.loadOb();
  }

  private hydrateProfileFromUser(): void {
    const u = this.auth.currentUser();
    if (!u) return;
    this.profileFirstName = u.firstName ?? '';
    this.profileLastName = u.lastName ?? '';
    this.profilePhone = u.phone ?? '';
    this.profileDepartment = u.department ?? '';
  }

  t(key: string): string {
    return this.translate.instant(key);
  }

  role(): UserRole | undefined {
    return this.auth.currentUser()?.role;
  }

  isAdmin(): boolean {
    return this.auth.hasPermission('SETTINGS_MANAGE');
  }

  isSuperAdmin(): boolean {
    return this.auth.hasPermission('SETTINGS_OPENING_BALANCE_TOGGLE');
  }

  canManageOb(): boolean {
    return this.isSuperAdmin() || this.role() === 'ADMIN';
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
      .getAllowOpeningBalance()
      .pipe(first())
      .subscribe({
        next: (s) => {
          this.obStatus.set(s);
          this.obLoading.set(false);
        },
        error: () => {
          this.obStatus.set({ value: 'LOCKED' });
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
    this.usersApi
      .putUser(u.id, {
        firstName: this.profileFirstName.trim(),
        lastName: this.profileLastName.trim(),
        phone: this.profilePhone.trim() || undefined,
        department: this.profileDepartment.trim() || undefined,
      })
      .pipe(first())
      .subscribe({
        next: () => {
          this.profileSaving.set(false);
          this.profileSuccess.set(true);
          this.message.success(this.t('SETTINGS.MSG_PROFILE_SAVED'));
          this.auth.getMe().pipe(first()).subscribe();
          setTimeout(() => this.profileSuccess.set(false), 3000);
        },
        error: (err: { error?: { message?: string }; message?: string }) => {
          this.profileSaving.set(false);
          this.profileError.set(err?.error?.message ?? err?.message ?? this.t('SETTINGS.ERR_PROFILE'));
        },
      });
  }

  savePassword(): void {
    const u = this.auth.currentUser();
    if (!u) return;
    if (this.passwordNew !== this.passwordConfirm) {
      this.passwordError.set(this.t('SETTINGS.ERR_PASSWORD_MATCH'));
      return;
    }
    if (this.passwordNew.length < 6) {
      this.passwordError.set(this.t('SETTINGS.ERR_PASSWORD_LEN'));
      return;
    }
    this.passwordSaving.set(true);
    this.passwordError.set('');
    this.passwordSuccess.set(false);
    this.usersApi
      .putUser(u.id, { password: this.passwordNew })
      .pipe(first())
      .subscribe({
        next: () => {
          this.passwordSaving.set(false);
          this.passwordSuccess.set(true);
          this.passwordNew = '';
          this.passwordConfirm = '';
          this.message.success(this.t('SETTINGS.MSG_PASSWORD_SAVED'));
          setTimeout(() => this.passwordSuccess.set(false), 3000);
        },
        error: (err: { error?: { message?: string }; message?: string }) => {
          this.passwordSaving.set(false);
          this.passwordError.set(err?.error?.message ?? err?.message ?? this.t('SETTINGS.ERR_PASSWORD'));
        },
      });
  }

  isObOpen(): boolean {
    return this.obStatus()?.value === 'OPEN';
  }

  onObSwitchClick(): void {
    if (!this.canManageOb() || this.obSaving() || this.obLoading()) {
      return;
    }
    this.obError.set('');
    if (!this.isObOpen()) {
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
            .obEnable()
            .pipe(first())
            .subscribe({
              next: () => {
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
                reject();
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
