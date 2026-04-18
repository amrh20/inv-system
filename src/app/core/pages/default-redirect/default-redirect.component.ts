import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import {
  BREAKAGE_NAV_PERMISSIONS_ANY,
  LOST_ITEMS_NAV_PERMISSIONS_ANY,
} from '../../constants/approvals-nav-permissions';
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
    let target = '/forbidden';
    if (role === 'SUPER_ADMIN') {
      target = '/admin/tenants';
    } else if (this.auth.hasPermission('VIEW_DASHBOARD')) {
      target = '/dashboard';
    } else if (this.auth.hasPermission('GET_PASS_VIEW')) {
      target = '/get-passes';
    } else if (BREAKAGE_NAV_PERMISSIONS_ANY.some((p) => this.auth.hasPermission(p))) {
      target = '/breakage';
    } else if (LOST_ITEMS_NAV_PERMISSIONS_ANY.some((p) => this.auth.hasPermission(p))) {
      target = '/lost-items';
    }
    void this.router.navigateByUrl(target, { replaceUrl: true });
  }
}
