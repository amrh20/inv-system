import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import {
  BREAKAGE_NAV_PERMISSIONS_ANY,
  LOST_ITEMS_NAV_PERMISSIONS_ANY,
} from '../constants/approvals-nav-permissions';
import { AuthService } from '../services/auth.service';

/**
 * When user navigates to '' (root), redirect based on role and permissions:
 * - SUPER_ADMIN → /admin/tenants
 * - VIEW_DASHBOARD → /dashboard
 * - Else GET_PASS_VIEW → /get-passes, then Breakage / Lost Items if any matching permission, else /forbidden
 */
export const defaultRedirectGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const role = auth.currentUser()?.role;
  if (role === 'SUPER_ADMIN') {
    return router.createUrlTree(['/admin/tenants']);
  }
  if (auth.hasPermission('VIEW_DASHBOARD')) {
    return router.createUrlTree(['/dashboard']);
  }
  if (auth.hasPermission('GET_PASS_VIEW')) {
    return router.createUrlTree(['/get-passes']);
  }
  if (BREAKAGE_NAV_PERMISSIONS_ANY.some((p) => auth.hasPermission(p))) {
    return router.createUrlTree(['/breakage']);
  }
  if (LOST_ITEMS_NAV_PERMISSIONS_ANY.some((p) => auth.hasPermission(p))) {
    return router.createUrlTree(['/lost-items']);
  }
  return router.createUrlTree(['/forbidden']);
};
