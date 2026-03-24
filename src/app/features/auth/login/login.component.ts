import { Component, signal, inject, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzDropDownModule } from 'ng-zorro-antd/dropdown';
import { NzModalModule, NzModalService } from 'ng-zorro-antd/modal';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { LucideAngularModule, Mail, Lock, Languages, Eye, EyeOff } from 'lucide-angular';
import { AuthService } from '../../../core/services/auth.service';
import { LanguageService } from '../../../core/services/language.service';
import {
  normalizeTenantMembershipsFromLogin,
  type LoginCredentials,
  type TenantMembership,
} from '../../../core/models';

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
  ],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent implements OnInit {
  private static readonly DEMO = {
    email: 'superadmin@ose.cloud',
    password: 'SuperAdmin@2026',
  } as const;

  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  private readonly translate = inject(TranslateService);
  private readonly modal = inject(NzModalService);
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
          this.navigateByRole(data.user.role);
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
        const errorData = this.coerceErrorBody(err?.error);
        this.error.set(
          errorData?.message ?? this.translate.instant('LOGIN.ERROR_INVALID_CREDENTIALS')
        );
      },
      complete: () => this.loading.set(false),
    });
  }

  private navigateByRole(role: string): void {
    if (role === 'SUPER_ADMIN') {
      this.router.navigate(['/admin/tenants'], { replaceUrl: true });
    } else {
      this.router.navigate(['/dashboard'], { replaceUrl: true });
    }
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
            this.navigateByRole(res.data.user.role);
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
