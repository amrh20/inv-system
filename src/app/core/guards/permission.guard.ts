import { inject } from '@angular/core';
import { type ActivatedRouteSnapshot, CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

/**
 * Generic permission-based route guard.
 * Expects `data.permission` as the required backend permission key.
 */
export const permissionGuard: CanActivateFn = (route: ActivatedRouteSnapshot) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const requiredPermission = route.data['permission'];

  if (typeof requiredPermission !== 'string' || requiredPermission.length === 0) {
    return true;
  }

  if (auth.hasPermission(requiredPermission)) {
    return true;
  }

  return router.createUrlTree(['/dashboard']);
};
