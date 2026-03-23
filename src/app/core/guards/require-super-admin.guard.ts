import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

/**
 * Protects Super Admin-only routes. Non–Super Admins are redirected to /dashboard.
 */
export const requireSuperAdminGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const role = auth.currentUser()?.role;
  if (role === 'SUPER_ADMIN') {
    return true;
  }
  return router.createUrlTree(['/dashboard']);
};
