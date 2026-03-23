import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

/**
 * Placeholder for '' route. The defaultRedirectGuard runs first and redirects
 * before this component renders. Kept as fallback if guard is bypassed.
 */
@Component({
  selector: 'app-default-redirect',
  standalone: true,
  template: '',
})
export class DefaultRedirectComponent {
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);

  constructor() {
    const role = this.auth.currentUser()?.role;
    const target = role === 'SUPER_ADMIN' ? '/admin' : '/dashboard';
    this.router.navigateByUrl(target, { replaceUrl: true });
  }
}
