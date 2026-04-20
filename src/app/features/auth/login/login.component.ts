import { HttpErrorResponse } from '@angular/common/http';
import { Component, signal, inject, OnInit } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzDropDownModule } from 'ng-zorro-antd/dropdown';
import { NzModalModule, NzModalService } from 'ng-zorro-antd/modal';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { LucideAngularModule, Mail, Lock, Languages, Eye, EyeOff } from 'lucide-angular';
import {
  BREAKAGE_NAV_PERMISSIONS_ANY,
  LOST_ITEMS_NAV_PERMISSIONS_ANY,
} from '../../../core/constants/approvals-nav-permissions';
import { AuthService } from '../../../core/services/auth.service';
import { LanguageService } from '../../../core/services/language.service';
import { SubscriptionNoticeService } from '../../../core/services/subscription-notice.service';
import {
  normalizeTenantMembershipsFromLogin,
  type LoginCredentials,
  type TenantMembership,
  type User,
} from '../../../core/models';
import {
  getSubscriptionExpiredMessage,
  getSubscriptionExpiredMessageFromApiEnvelope,
  isSubscriptionExpiredApiEnvelope,
  isSubscriptionExpiredHttpError,
} from '../../../core/utils/subscription-http-error.util';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    NzFormModule,
    NzInputModule,
    NzButtonModule,
    NzAlertModule,
    NzDropDownModule,
    NzModalModule,
    LucideAngularModule,
    TranslatePipe,
    RouterLink,
  ],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent implements OnInit {
  private static readonly DEMO = {
    email: 'superadmin@ose.cloud',
    password: 'SuperAdmin@2026',
  } as const;
  private static readonly LOGIN_REDIRECTS: readonly {
    path: string;
    permission?: string;
    permissionsAny?: readonly string[];
  }[] = [
    { path: '/dashboard', permission: 'VIEW_DASHBOARD' },
    { path: '/get-passes', permission: 'GET_PASS_VIEW' },
    { path: '/breakage', permissionsAny: [...BREAKAGE_NAV_PERMISSIONS_ANY] },
    { path: '/lost-items', permissionsAny: [...LOST_ITEMS_NAV_PERMISSIONS_ANY] },
    { path: '/stock', permission: 'INVENTORY_VIEW' },
    { path: '/reports', permission: 'REPORTS_VIEW' },
    { path: '/settings', permission: 'SETTINGS_MANAGE' },
    { path: '/users', permission: 'USERS_COMPANY_MANAGE' },
    { path: '/audit-log', permission: 'AUDIT_LOG_VIEW' },
    { path: '/inventory-history', permission: 'INVENTORY_VIEW' },
  ];

  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  private readonly translate = inject(TranslateService);
  private readonly modal = inject(NzModalService);
  private readonly subscriptionNotice = inject(SubscriptionNoticeService);
  readonly language = inject(LanguageService);

  readonly loading = signal(false);
  readonly error = signal('');
  readonly showDemoPanel = signal(false);
  readonly showPassword = signal(false);

  readonly lucideMail = Mail;
  readonly lucideLock = Lock;
  readonly lucideLanguages = Languages;
  readonly lucideEye = Eye;
  readonly lucideEyeOff = EyeOff;

  readonly stats = [
    { value: '99.9%', label: 'LOGIN.STATS.UPTIME' },
    { value: '<500ms', label: 'LOGIN.STATS.DASHBOARD_LOAD' },
    { value: '30+', label: 'LOGIN.STATS.REPORTS' },
    { value: '5', label: 'LOGIN.STATS.STORES' },
  ];

  form: FormGroup = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });

  constructor() {}

  ngOnInit(): void {
    localStorage.removeItem('tenantSlug');
  }

  toggleDemoPanel() {
    this.showDemoPanel.update((v) => !v);
  }

  togglePasswordVisibility() {
    this.showPassword.update((v) => !v);
  }

  fillDemo() {
    this.form.patchValue({
      email: LoginComponent.DEMO.email,
      password: LoginComponent.DEMO.password,
    });
    this.error.set('');
    this.showDemoPanel.set(false);
  }

  onSubmit() {
    console.log('Attempting Login...');
    this.error.set('');
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.loading.set(true);
    const credentials: LoginCredentials = {
      email: this.form.value.email,
      password: this.form.value.password,
    };
    this.auth.login(credentials).subscribe({
      next: (res) => {
        const data = res?.data;
        const accountInactiveMessage = this.getAccountInactiveMessage(res);
        if (accountInactiveMessage) {
          this.loading.set(false);
          this.showAccountInactiveModal(accountInactiveMessage);
          return;
        }

        if (res?.success && data?.user) {
          if (data.user.tenant?.subStatus === 'EXPIRED' && !this.isSuperAdmin(data.user)) {
            this.auth.clearAuth();
            this.subscriptionNotice.showExpiredNotice(null);
            this.loading.set(false);
            return;
          }
          this.navigateAfterLogin();
          return;
        }

        if (isSubscriptionExpiredApiEnvelope(res)) {
          this.auth.clearAuth();
          this.subscriptionNotice.showExpiredNotice(
            getSubscriptionExpiredMessageFromApiEnvelope(res),
          );
          this.loading.set(false);
          return;
        }

        const requiresTenantSelection =
          res?.requiresTenantSelection === true || data?.requiresTenantSelection === true;
        if (res?.success && requiresTenantSelection) {
          const envelopeMemberships = (res as { memberships?: unknown[] })?.memberships;
          const rawMemberships =
            (Array.isArray(data?.memberships) && data.memberships.length > 0
              ? data.memberships
              : undefined) ??
            (Array.isArray(envelopeMemberships) && envelopeMemberships.length > 0
              ? envelopeMemberships
              : undefined) ??
            data?.user?.memberships ??
            [];

          const memberships = normalizeTenantMembershipsFromLogin(rawMemberships);
          if (memberships.length > 0) {
            this.completeLoginWithMembership(credentials, memberships[0], memberships);
            return;
          }

          this.loading.set(false);
          this.error.set(this.translate.instant('LOGIN.ERROR_SELECT_TENANT_RETRY'));
          return;
        }

        this.error.set(res?.message?.trim() || this.translate.instant('LOGIN.ERROR_INVALID_CREDENTIALS'));
      },
      error: (err) => {
        this.loading.set(false);
        const accountInactiveMessage = this.getAccountInactiveMessage(err?.error);
        if (accountInactiveMessage !== null) {
          this.error.set('');
          this.modal.error({
            nzTitle: this.translate.instant('LOGIN.ACCOUNT_INACTIVE_TITLE'),
            nzContent: accountInactiveMessage,
            nzMaskClosable: false,
            nzClosable: false,
            nzKeyboard: false,
            nzOkText: this.translate.instant('COMMON.OK'),
          });
          return;
        }
        if (err instanceof HttpErrorResponse && isSubscriptionExpiredHttpError(err)) {
          this.error.set('');
          this.auth.clearAuth();
          this.subscriptionNotice.showExpiredNotice(getSubscriptionExpiredMessage(err));
          return;
        }
        const errorData = this.coerceErrorBody(err?.error);
        this.error.set(
          errorData?.message ?? this.translate.instant('LOGIN.ERROR_INVALID_CREDENTIALS')
        );
      },
      complete: () => this.loading.set(false),
    });
  }

  private navigateAfterLogin(): void {
    if (this.auth.currentUser()?.role === 'SUPER_ADMIN') {
      void this.router.navigate(['/admin/tenants'], { replaceUrl: true });
      return;
    }

    const singlePropertySlug = this.auth.getSinglePropertyTenantSlugForOrgManager();
    if (singlePropertySlug) {
      if (this.auth.currentTenant()?.slug === singlePropertySlug) {
        void this.router.navigateByUrl(`/${singlePropertySlug}/dashboard`, { replaceUrl: true });
        return;
      }
      this.auth.switchTenant(singlePropertySlug).subscribe({
        next: () => {
          void this.router.navigateByUrl(`/${singlePropertySlug}/dashboard`, { replaceUrl: true });
        },
        error: () => {
          void this.router.navigate(['/dashboard'], { replaceUrl: true });
        },
      });
      return;
    }

    const target = LoginComponent.LOGIN_REDIRECTS.find((route) => {
      if (route.permissionsAny && route.permissionsAny.length > 0) {
        return route.permissionsAny.some((p) => this.auth.hasPermission(p));
      }
      return !route.permission || this.auth.hasPermission(route.permission);
    })?.path;
    if (target) {
      void this.router.navigate([target], { replaceUrl: true });
      return;
    }
    if (this.auth.hasPermission('GET_PASS_VIEW')) {
      void this.router.navigate(['/get-passes'], { replaceUrl: true });
      return;
    }
    if (BREAKAGE_NAV_PERMISSIONS_ANY.some((p) => this.auth.hasPermission(p))) {
      void this.router.navigate(['/breakage'], { replaceUrl: true });
      return;
    }
    if (LOST_ITEMS_NAV_PERMISSIONS_ANY.some((p) => this.auth.hasPermission(p))) {
      void this.router.navigate(['/lost-items'], { replaceUrl: true });
      return;
    }
    void this.router.navigate(['/forbidden'], { replaceUrl: true });
  }

  private isSuperAdmin(user: User): boolean {
    return user.role === 'SUPER_ADMIN';
  }

  private showAccountInactiveModal(apiMessage?: string): void {
    this.error.set('');
    const backendMessage = apiMessage?.trim();
    this.modal.error({
      nzTitle: this.translate.instant('LOGIN.ACCOUNT_INACTIVE_TITLE'),
      nzContent: backendMessage || this.translate.instant('LOGIN.ACCOUNT_INACTIVE_CONTENT'),
      nzMaskClosable: false,
      nzClosable: false,
      nzKeyboard: false,
      nzOkText: this.translate.instant('COMMON.OK'),
    });
  }

  private completeLoginWithMembership(
    credentials: LoginCredentials,
    membership: TenantMembership,
    memberships: TenantMembership[],
  ): void {
    this.error.set('');
    this.loading.set(true);

    this.auth
      .login({
        email: credentials.email,
        password: credentials.password,
        tenantSlug: membership.tenantSlug,
        selectedTenantId: membership.tenantId,
        selectedRole: membership.role,
        memberships,
      })
      .subscribe({
        next: (res) => {
          const accountInactiveMessage = this.getAccountInactiveMessage(res);
          if (accountInactiveMessage) {
            this.showAccountInactiveModal(accountInactiveMessage);
            return;
          }
          if (res?.success && res.data?.user) {
            const user = res.data.user;
            if (user.tenant?.subStatus === 'EXPIRED' && !this.isSuperAdmin(user)) {
              this.auth.clearAuth();
              this.subscriptionNotice.showExpiredNotice(null);
              return;
            }
            this.navigateAfterLogin();
            return;
          }
          if (isSubscriptionExpiredApiEnvelope(res)) {
            this.auth.clearAuth();
            this.subscriptionNotice.showExpiredNotice(
              getSubscriptionExpiredMessageFromApiEnvelope(res),
            );
            return;
          }
          this.error.set(res?.message?.trim() || this.translate.instant('LOGIN.ERROR_INVALID_CREDENTIALS'));
        },
        error: (err) => {
          this.loading.set(false);
          const accountInactiveMessage = this.getAccountInactiveMessage(err?.error);
          if (accountInactiveMessage !== null) {
            this.error.set('');
            this.modal.error({
              nzTitle: this.translate.instant('LOGIN.ACCOUNT_INACTIVE_TITLE'),
              nzContent: accountInactiveMessage,
              nzMaskClosable: false,
              nzClosable: false,
              nzKeyboard: false,
              nzOkText: this.translate.instant('COMMON.OK'),
            });
            return;
          }
          if (err instanceof HttpErrorResponse && isSubscriptionExpiredHttpError(err)) {
            this.error.set('');
            this.auth.clearAuth();
            this.subscriptionNotice.showExpiredNotice(getSubscriptionExpiredMessage(err));
            return;
          }
          const errorData = this.coerceErrorBody(err?.error);
          this.error.set(
            errorData?.message ?? this.translate.instant('LOGIN.ERROR_INVALID_CREDENTIALS')
          );
        },
        complete: () => this.loading.set(false),
      });
  }

  private getAccountInactiveMessage(
    payload: unknown,
  ): string | null {
    const body = this.coerceErrorBody(payload);
    if (!body || typeof body !== 'object') {
      return null;
    }

    const code = body.error ?? body.code ?? body.data?.error ?? body.data?.code;
    if (code !== 'ACCOUNT_INACTIVE') {
      return null;
    }

    return (
      body.message?.trim() ||
      body.data?.message?.trim() ||
      this.translate.instant('LOGIN.ACCOUNT_INACTIVE_CONTENT')
    );
  }

  private coerceErrorBody(payload: unknown): {
    error?: string;
    code?: string;
    message?: string;
    data?: { error?: string; code?: string; message?: string };
  } | null {
    if (!payload) {
      return null;
    }

    if (typeof payload === 'string') {
      try {
        return JSON.parse(payload) as {
          error?: string;
          code?: string;
          message?: string;
          data?: { error?: string; code?: string; message?: string };
        };
      } catch {
        return { message: payload };
      }
    }

    if (typeof payload === 'object') {
      return payload as {
        error?: string;
        code?: string;
        message?: string;
        data?: { error?: string; code?: string; message?: string };
      };
    }

    return null;
  }
}
