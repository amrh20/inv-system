import { inject } from '@angular/core';
import { type ActivatedRouteSnapshot, CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

/** Avoid redirect loops when `/dashboard` itself requires a permission the user lacks. */
function redirectWhenPermissionDenied(router: Router, auth: AuthService) {
  if (auth.hasPermission('VIEW_DASHBOARD')) {
    return router.createUrlTree(['/dashboard']);
  }
  if (auth.hasPermission('GET_PASS_VIEW')) {
    return router.createUrlTree(['/get-passes']);
  }
  if (auth.hasPermission('BREAKAGE_VIEW')) {
    return router.createUrlTree(['/breakage']);
  }
  if (auth.hasPermission('LOST_ITEMS_VIEW')) {
    return router.createUrlTree(['/lost-items']);
  }
  return router.createUrlTree(['/forbidden']);
}

/**
 * Generic permission-based route guard.
 * - `data.permissionsAny`: string[] — user needs at least one of these permissions.
 * - `data.permission`: string — user needs this single permission (if no `permissionsAny`).
 */
export const permissionGuard: CanActivateFn = (route: ActivatedRouteSnapshot) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const anyOf = route.data['permissionsAny'] as string[] | undefined;
  if (Array.isArray(anyOf) && anyOf.length > 0) {
    if (anyOf.some((p) => typeof p === 'string' && p.length > 0 && auth.hasPermission(p))) {
      return true;
    }
    return redirectWhenPermissionDenied(router, auth);
  }

  const requiredPermission = route.data['permission'];

  if (typeof requiredPermission !== 'string' || requiredPermission.length === 0) {
    return true;
  }

  if (auth.hasPermission(requiredPermission)) {
    return true;
  }

  return redirectWhenPermissionDenied(router, auth);
};
