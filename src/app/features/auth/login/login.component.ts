import { Component, signal, inject, effect } from '@angular/core';
import { Router } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzDropDownModule } from 'ng-zorro-antd/dropdown';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { LucideAngularModule, Hotel, Mail, Lock, Languages, Eye, EyeOff } from 'lucide-angular';
import { AuthService } from '../../../core/services/auth.service';
import { LanguageService } from '../../../core/services/language.service';
import type { LoginCredentials } from '../../../core/models';

export type AuthType = 'hotel' | 'admin';

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
    LucideAngularModule,
    TranslatePipe,
  ],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent {
  private static readonly HOTEL_DEMO = {
    tenantSlug: 'grand-horizon',
    email: 'admin@grandhorizon.com',
    password: 'Admin@123',
  } as const;

  private static readonly SUPER_ADMIN_DEMO = {
    email: 'superadmin@ose.cloud',
    password: 'SuperAdmin@2026',
  } as const;

  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  private readonly translate = inject(TranslateService);
  readonly language = inject(LanguageService);

  readonly authType = signal<AuthType>('hotel');
  readonly loading = signal(false);
  readonly error = signal('');
  readonly showDemoPanel = signal(false);
  readonly showPassword = signal(false);

  readonly lucideHotel = Hotel;
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
    tenantSlug: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });

  constructor() {
    effect(() => {
      const isAdmin = this.authType() === 'admin';
      this.error.set('');
      const control = this.form.get('tenantSlug');
      if (isAdmin) {
        control?.clearValidators();
      } else {
        control?.setValidators(Validators.required);
      }
      control?.updateValueAndValidity();
    });
  }

  setAuthType(type: AuthType) {
    this.authType.set(type);
  }

  toggleDemoPanel() {
    this.showDemoPanel.update((v) => !v);
  }

  togglePasswordVisibility() {
    this.showPassword.update((v) => !v);
  }

  fillDemo() {
    if (this.authType() === 'admin') {
      this.form.patchValue({
        tenantSlug: '',
        email: LoginComponent.SUPER_ADMIN_DEMO.email,
        password: LoginComponent.SUPER_ADMIN_DEMO.password,
      });
    } else {
      this.form.patchValue({
        tenantSlug: LoginComponent.HOTEL_DEMO.tenantSlug,
        email: LoginComponent.HOTEL_DEMO.email,
        password: LoginComponent.HOTEL_DEMO.password,
      });
    }
    this.error.set('');
    this.showDemoPanel.set(false);
  }

  onSubmit() {
    this.error.set('');
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.loading.set(true);
    const credentials: LoginCredentials = {
      email: this.form.value.email,
      password: this.form.value.password,
      tenantSlug: this.authType() === 'admin' ? undefined : this.form.value.tenantSlug,
    };
    this.auth.login(credentials).subscribe({
      next: (res) => {
        if (res?.success && res.data?.user) {
          const role = res.data.user.role;
          if (role === 'SUPER_ADMIN') {
            this.router.navigate(['/admin'], { replaceUrl: true });
          } else {
            this.router.navigate(['/dashboard'], { replaceUrl: true });
          }
        }
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(
          err?.error?.message ?? this.translate.instant('LOGIN.ERROR_INVALID_CREDENTIALS')
        );
      },
      complete: () => this.loading.set(false),
    });
  }
}
