import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, OnInit, signal } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { first } from 'rxjs';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzDropDownModule } from 'ng-zorro-antd/dropdown';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { LucideAngularModule, Eye, EyeOff, KeyRound, Languages, Lock, Mail } from 'lucide-angular';
import { AuthService } from '../../../core/services/auth.service';
import { LanguageService } from '../../../core/services/language.service';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    NzAlertModule,
    NzButtonModule,
    NzCardModule,
    NzDropDownModule,
    NzFormModule,
    NzInputModule,
    LucideAngularModule,
    TranslatePipe,
  ],
  templateUrl: './reset-password.component.html',
  styleUrl: './reset-password.component.scss',
})
export class ResetPasswordComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly translate = inject(TranslateService);
  private readonly message = inject(NzMessageService);
  readonly language = inject(LanguageService);

  readonly loading = signal(false);
  readonly error = signal('');
  readonly showPassword = signal(false);

  readonly lucideMail = Mail;
  readonly lucideLock = Lock;
  readonly lucideKey = KeyRound;
  readonly lucideEye = Eye;
  readonly lucideEyeOff = EyeOff;
  readonly lucideLanguages = Languages;

  readonly form = this.fb.nonNullable.group(
    {
      email: ['', [Validators.required, Validators.email]],
      otp: ['', [Validators.required, Validators.pattern(/^\d{6}$/)]],
      newPassword: ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword: ['', Validators.required],
    },
    { validators: [ResetPasswordComponent.passwordsMatch] },
  );

  ngOnInit(): void {
    const email = this.route.snapshot.queryParamMap.get('email');
    if (email?.trim()) {
      this.form.patchValue({ email: email.trim() });
    }
  }

  private static passwordsMatch(group: AbstractControl): ValidationErrors | null {
    const newPassword = group.get('newPassword')?.value;
    const confirmPassword = group.get('confirmPassword')?.value;
    if (newPassword == null || confirmPassword == null) {
      return null;
    }
    return newPassword === confirmPassword ? null : { passwordMismatch: true };
  }

  togglePasswordVisibility(): void {
    this.showPassword.update((v) => !v);
  }

  submit(): void {
    this.error.set('');
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      if (this.form.hasError('passwordMismatch')) {
        this.error.set(this.translate.instant('AUTH.RESET_PASSWORD.ERR_PASSWORD_MATCH'));
      }
      return;
    }
    const { email, otp, newPassword } = this.form.getRawValue();
    this.loading.set(true);
    this.auth
      .resetPassword({
        email: email.trim(),
        otp: otp.trim(),
        newPassword,
      })
      .pipe(first())
      .subscribe({
        next: (res) => {
          this.loading.set(false);
          if (res.success) {
            this.message.success(this.translate.instant('AUTH.RESET_PASSWORD.MSG_SUCCESS'));
            void this.router.navigate(['/login'], { replaceUrl: true });
            return;
          }
          this.error.set(
            res.message?.trim() || this.translate.instant('AUTH.RESET_PASSWORD.ERROR_GENERIC'),
          );
        },
        error: (err: HttpErrorResponse) => {
          this.loading.set(false);
          const body = err.error as { message?: string } | undefined;
          this.error.set(
            body?.message?.trim() ||
              err.message ||
              this.translate.instant('AUTH.RESET_PASSWORD.ERROR_GENERIC'),
          );
        },
      });
  }
}
