import { NgTemplateOutlet, UpperCasePipe } from '@angular/common';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { TranslatePipe } from '@ngx-translate/core';
import { LucideAngularModule } from 'lucide-angular';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzDropDownModule } from 'ng-zorro-antd/dropdown';
import { NzMenuModule } from 'ng-zorro-antd/menu';
import {
  Building2,
  ChevronDown,
  ChevronRight,
  LayoutDashboard,
  LogOut,
  Menu,
  ScrollText,
  Shield,
  X,
} from 'lucide-angular';
import { AuthService } from '../../../core/services/auth.service';

const NAV_ITEMS = [
  {
    path: '/admin/tenants',
    icon: Building2,
    labelKey: 'SUPER_ADMIN.HOTEL_MANAGEMENT',
    descKey: 'SUPER_ADMIN.HOTEL_MANAGEMENT_DESC',
  },
  {
    path: '/admin/logs',
    icon: ScrollText,
    labelKey: 'SUPER_ADMIN.AUDIT_LOG',
    descKey: 'SUPER_ADMIN.AUDIT_LOG_DESC',
  },
];

@Component({
  selector: 'app-super-admin-layout',
  standalone: true,
  imports: [
    NgTemplateOutlet,
    UpperCasePipe,
    RouterLink,
    RouterLinkActive,
    RouterOutlet,
    TranslatePipe,
    LucideAngularModule,
    NzButtonModule,
    NzDrawerModule,
    NzDropDownModule,
    NzMenuModule,
  ],
  templateUrl: './super-admin-layout.component.html',
  styleUrl: './super-admin-layout.component.scss',
})
export class SuperAdminLayoutComponent {
  private static initialLayoutMode(): 'mobile' | 'desktop' {
    if (typeof window === 'undefined') {
      return 'desktop';
    }
    return window.innerWidth < 768 ? 'mobile' : 'desktop';
  }

  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly navItems = NAV_ITEMS;
  readonly lucideShield = Shield;
  readonly lucideLogOut = LogOut;
  readonly lucideLayoutDashboard = LayoutDashboard;
  readonly lucideChevronRight = ChevronRight;
  readonly lucideChevronDown = ChevronDown;
  readonly lucideMenu = Menu;
  readonly lucideClose = X;
  readonly currentUser = this.auth.currentUser;

  /** Same breakpoint as main shell: drawer navigation below 768px. */
  readonly layoutMode = signal<'mobile' | 'desktop'>(SuperAdminLayoutComponent.initialLayoutMode());
  readonly mobileDrawerOpen = signal(false);

  constructor() {
    this.router.events
      .pipe(
        filter((e): e is NavigationEnd => e instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => {
        if (this.layoutMode() === 'mobile') {
          this.mobileDrawerOpen.set(false);
        }
      });

    if (typeof window !== 'undefined') {
      this.applyLayoutMode();
      window.addEventListener('resize', this.onWindowResize, { passive: true });
      this.destroyRef.onDestroy(() => window.removeEventListener('resize', this.onWindowResize));
    }
  }

  private readonly onWindowResize = (): void => {
    this.applyLayoutMode();
  };

  private applyLayoutMode(): void {
    if (typeof window === 'undefined') {
      return;
    }
    const next: 'mobile' | 'desktop' = window.innerWidth < 768 ? 'mobile' : 'desktop';
    const prev = this.layoutMode();
    this.layoutMode.set(next);
    if (prev === 'mobile' && next !== 'mobile') {
      this.mobileDrawerOpen.set(false);
    }
  }

  toggleMobileNav(): void {
    this.mobileDrawerOpen.update((v) => !v);
  }

  displayName(): string {
    const user = this.currentUser();
    if (!user) return 'User';
    return `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || user.email;
  }

  logout(): void {
    this.auth.logout();
  }
}
