import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

/**
 * When user navigates to '' (root), redirect based on role:
 * - SUPER_ADMIN → /admin (platform controls)
 * - Others → /dashboard
 */
export const defaultRedirectGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const role = auth.currentUser()?.role;
  const target = role === 'SUPER_ADMIN' ? '/admin' : '/dashboard';
  return router.createUrlTree([target]);
};
