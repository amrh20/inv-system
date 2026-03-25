import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import type { UserRole } from '../models/enums';
import { AuthService } from '../services/auth.service';

const ADMIN_SECTION_ROLES: readonly UserRole[] = ['ADMIN', 'ORG_MANAGER', 'SUPER_ADMIN'];

/**
 * Tenant admin area: Users, Audit Log, Inventory History, Settings.
 */
export const adminSectionGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const role = auth.currentUser()?.role;
  // Organization root context stays dashboard-only even for ORG_MANAGER.
  if (auth.isParentOrganizationContext()) {
    return router.createUrlTree(['/dashboard']);
  }
  if (role && ADMIN_SECTION_ROLES.includes(role)) {
    return true;
  }
  return router.createUrlTree(['/dashboard']);
};
