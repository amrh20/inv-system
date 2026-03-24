import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

/**
 * Blocks Super Admin from accessing main layout routes (dashboard, items, etc.)
 * which require tenantId. Redirects to /admin/tenants instead.
 */
export const blockSuperAdminDashboardGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const role = auth.currentUser()?.role;
  if (role === 'SUPER_ADMIN') {
    return router.createUrlTree(['/admin/tenants']);
  }
  return true;
};
