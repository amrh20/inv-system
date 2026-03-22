import { Component, signal, inject } from '@angular/core';
import { Router } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { AuthService } from '../../../core/services/auth.service';
import type { LoginCredentials } from '../../../core/models';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    NzFormModule,
    NzInputModule,
    NzButtonModule,
    NzAlertModule,
    TranslatePipe,
  ],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  private readonly translate = inject(TranslateService);

  readonly isSuperAdmin = signal(false);
  readonly loading = signal(false);
  readonly error = signal('');

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

  toggleSuperAdmin() {
    this.isSuperAdmin.update((v) => !v);
    this.error.set('');
    if (this.isSuperAdmin()) {
      this.form.get('tenantSlug')?.clearValidators();
    } else {
      this.form.get('tenantSlug')?.setValidators(Validators.required);
    }
    this.form.get('tenantSlug')?.updateValueAndValidity();
  }

  fillDemo() {
    this.isSuperAdmin.set(false);
    this.form.patchValue({
      tenantSlug: 'grand-horizon',
      email: 'admin@grandhorizon.com',
      password: 'Admin@123',
    });
    this.form.get('tenantSlug')?.setValidators(Validators.required);
    this.form.get('tenantSlug')?.updateValueAndValidity();
    this.error.set('');
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
      tenantSlug: this.isSuperAdmin() ? undefined : this.form.value.tenantSlug,
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
        this.error.set(
          err?.error?.message ?? this.translate.instant('LOGIN.ERROR_INVALID_CREDENTIALS')
        );
      },
      complete: () => this.loading.set(false),
    });
  }
}
