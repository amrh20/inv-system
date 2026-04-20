import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { AuthService } from '../services/auth.service';

/**
 * Ensures `/:tenantSlug/dashboard` runs under the matching active tenant context.
 * Switches tenant before route activation to avoid dashboard flicker.
 */
export const tenantDashboardContextGuard: CanActivateFn = (route) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const requestedSlug = route.paramMap.get('tenantSlug')?.trim();

  if (!requestedSlug) {
    return router.parseUrl('/dashboard');
  }

  if (auth.currentTenant()?.slug === requestedSlug) {
    return true;
  }

  return auth.switchTenant(requestedSlug).pipe(
    map((res) => (res?.success ? true : (router.parseUrl('/dashboard') as UrlTree))),
    catchError(() => of(router.parseUrl('/dashboard'))),
  );
};
