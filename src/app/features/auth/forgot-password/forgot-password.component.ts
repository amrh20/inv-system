import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { first } from 'rxjs';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzDropDownModule } from 'ng-zorro-antd/dropdown';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { LucideAngularModule, Languages, Mail } from 'lucide-angular';
import { AuthService } from '../../../core/services/auth.service';
import { LanguageService } from '../../../core/services/language.service';

@Component({
  selector: 'app-forgot-password',
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
  templateUrl: './forgot-password.component.html',
  styleUrl: './forgot-password.component.scss',
})
export class ForgotPasswordComponent {
  private readonly auth = inject(AuthService);
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly translate = inject(TranslateService);
  private readonly message = inject(NzMessageService);
  readonly language = inject(LanguageService);

  readonly loading = signal(false);
  readonly error = signal('');

  readonly lucideMail = Mail;
  readonly lucideLanguages = Languages;

  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
  });

  submit(): void {
    this.error.set('');
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const email = this.form.controls.email.value.trim();
    this.loading.set(true);
    this.auth
      .forgotPassword(email)
      .pipe(first())
      .subscribe({
        next: (res) => {
          this.loading.set(false);
          if (res.success) {
            this.message.success(this.translate.instant('AUTH.FORGOT_PASSWORD.MSG_SENT'));
            void this.router.navigate(['/reset-password'], {
              queryParams: { email },
              replaceUrl: false,
            });
            return;
          }
          this.error.set(
            res.message?.trim() || this.translate.instant('AUTH.FORGOT_PASSWORD.ERROR_GENERIC'),
          );
        },
        error: (err: HttpErrorResponse) => {
          this.loading.set(false);
          const body = err.error as { message?: string } | undefined;
          this.error.set(
            body?.message?.trim() ||
              err.message ||
              this.translate.instant('AUTH.FORGOT_PASSWORD.ERROR_GENERIC'),
          );
        },
      });
  }
}
