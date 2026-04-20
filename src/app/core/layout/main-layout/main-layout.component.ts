import { Component, computed, DestroyRef, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { NzLayoutModule } from 'ng-zorro-antd/layout';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzBreadCrumbModule } from 'ng-zorro-antd/breadcrumb';
import { NzDropDownModule } from 'ng-zorro-antd/dropdown';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTooltipModule } from 'ng-zorro-antd/tooltip';
import { LucideAngularModule } from 'lucide-angular';
import { Check, ChevronDown, Languages, LogOut, Menu, Moon, Search, Sun, X } from 'lucide-angular';
import { AuthService } from '../../services/auth.service';
import { NavigationService } from '../../services/navigation.service';
import { ShellSidebarNavComponent } from './shell-sidebar-nav/shell-sidebar-nav.component';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { LanguageService } from '../../services/language.service';
import type { UserMembership } from '../../models';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [
    RouterOutlet,
    RouterLink,
    NzLayoutModule,
    NzDrawerModule,
    NzBreadCrumbModule,
    NzDropDownModule,
    NzButtonModule,
    NzInputModule,
    NzSpinModule,
    NzTooltipModule,
    LucideAngularModule,
    FormsModule,
    TranslatePipe,
    ShellSidebarNavComponent,
  ],
  templateUrl: './main-layout.component.html',
  styleUrl: './main-layout.component.scss',
})
export class MainLayoutComponent {
  private static initialLayoutMode(): 'mobile' | 'tablet' | 'desktop' {
    if (typeof window === 'undefined') {
      return 'desktop';
    }
    const w = window.innerWidth;
    if (w < 768) {
      return 'mobile';
    }
    if (w < 1024) {
      return 'tablet';
    }
    return 'desktop';
  }

  /** Icon rail on tablet/mobile; expanded by default on wide desktop only. */
  private static initialSidebarExpanded(): boolean {
    if (typeof window === 'undefined') {
      return true;
    }
    return window.innerWidth >= 1024;
  }

  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  readonly auth = inject(AuthService);
  readonly nav = inject(NavigationService);
  readonly language = inject(LanguageService);

  readonly sidebarExpanded = signal(MainLayoutComponent.initialSidebarExpanded());
  /** `<768px`: navigation uses a drawer; sider hidden. */
  readonly layoutMode = signal<'mobile' | 'tablet' | 'desktop'>(MainLayoutComponent.initialLayoutMode());
  readonly mobileDrawerOpen = signal(false);
  readonly isDarkMode = signal(this.readThemeFromStorage());
  readonly breadcrumbs = signal<{ label: string; link?: string }[]>([]);
  readonly searchQuery = signal('');
  readonly switchingTenant = signal(false);

  readonly lucideMenu = Menu;
  readonly lucideClose = X;
  readonly lucideMoon = Moon;
  readonly lucideSun = Sun;
  readonly lucideChevronDown = ChevronDown;
  readonly lucideCheck = Check;
  readonly lucideLogOut = LogOut;
  readonly lucideSearch = Search;
  readonly lucideLanguages = Languages;

  /** Tablet and desktop collapsed use icon rail; mobile hides sider. */
  readonly siderCollapsed = computed(() => {
    const m = this.layoutMode();
    if (m === 'mobile') {
      return true;
    }
    if (m === 'tablet') {
      return true;
    }
    return !this.sidebarExpanded();
  });

  constructor() {
    effect(() => {
      const dark = this.isDarkMode();
      document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
      localStorage.setItem('theme', dark ? 'dark' : 'light');
    });

    this.router.events
      .pipe(
        filter((e): e is NavigationEnd => e instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => {
        this.refreshBreadcrumbs();
        if (this.layoutMode() === 'mobile') {
          this.mobileDrawerOpen.set(false);
        }
      });

    this.refreshBreadcrumbs();

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
    const w = window.innerWidth;
    const next: 'mobile' | 'tablet' | 'desktop' =
      w < 768 ? 'mobile' : w < 1024 ? 'tablet' : 'desktop';
    const prev = this.layoutMode();
    this.layoutMode.set(next);
    if (prev === 'mobile' && next !== 'mobile') {
      this.mobileDrawerOpen.set(false);
    }
    if (next === 'tablet' || next === 'mobile') {
      this.sidebarExpanded.set(false);
    }
  }

  toggleHeaderNav(): void {
    if (this.layoutMode() === 'mobile') {
      this.mobileDrawerOpen.update((v) => !v);
      return;
    }
    if (this.layoutMode() === 'tablet') {
      return;
    }
    this.sidebarExpanded.update((v) => !v);
  }

  /** Keep state in sync when nz-sider emits collapsed changes (e.g. internal updates). */
  onSiderCollapsedChange(collapsed: boolean): void {
    if (this.layoutMode() === 'tablet') {
      return;
    }
    this.sidebarExpanded.set(!collapsed);
  }

  toggleTheme(): void {
    this.isDarkMode.update((v) => !v);
  }

  logout(): void {
    this.auth.logout();
  }

  displayName(): string {
    const u = this.auth.currentUser();
    if (!u) return 'User';
    return u.firstName || u.email.split('@')[0] || 'User';
  }

  avatarLetter(): string {
    const u = this.auth.currentUser();
    if (!u) return 'U';
    const c = u.firstName?.[0] ?? u.email?.[0];
    return c ? c.toUpperCase() : 'U';
  }

  tenantLabel(): string {
    const u = this.auth.currentUser();
    return u?.tenant?.slug?.toUpperCase() ?? 'SYSTEM';
  }

  isSuperAdmin(): boolean {
    return this.auth.currentUser()?.role === 'SUPER_ADMIN';
  }

  currentTenantName(): string {
    const tenant = this.auth.currentTenant();
    const user = this.auth.currentUser();
    if (this.isSuperAdmin()) {
      return 'System';
    }
    return tenant?.name ?? tenant?.slug ?? user?.tenant?.name ?? user?.tenant?.slug ?? 'Hotel';
  }

  tenantSwitcherItems(): UserMembership[] {
    return this.auth.getSwitchableMemberships();
  }

  showTenantSwitcher(): boolean {
    if (this.isSuperAdmin()) {
      return false;
    }
    if (this.auth.getSinglePropertyTenantSlugForOrgManager()) {
      return false;
    }
    return this.tenantSwitcherItems().length > 1;
  }

  onSwitchTenant(tenantSlug: string): void {
    if (!tenantSlug || this.switchingTenant() || this.isTenantSlugActive(tenantSlug)) {
      return;
    }
    this.switchingTenant.set(true);
    this.auth.switchTenant(tenantSlug).subscribe({
      next: () => {
        this.switchingTenant.set(false);
        const targetSlug = this.auth.currentTenant()?.slug;
        window.location.href = targetSlug ? `/${targetSlug}/dashboard` : '/dashboard';
      },
      error: () => {
        this.switchingTenant.set(false);
      },
    });
  }

  isActiveTenant(membership: UserMembership): boolean {
    const currentTenant = this.auth.currentTenant();
    if (currentTenant?.slug && membership.tenantSlug === currentTenant.slug) {
      return true;
    }
    return !!currentTenant?.id && membership.tenantId === currentTenant.id;
  }

  private isTenantSlugActive(tenantSlug: string): boolean {
    return this.auth.currentTenant()?.slug === tenantSlug;
  }

  private readThemeFromStorage(): boolean {
    if (typeof localStorage === 'undefined') {
      return false;
    }
    return localStorage.getItem('theme') === 'dark';
  }

  private refreshBreadcrumbs(): void {
    let route = this.router.routerState.snapshot.root;
    let url = '';
    const items: { label: string; link?: string }[] = [];
    while (route.firstChild) {
      route = route.firstChild;
      const segment = route.url.map((s) => s.path).join('/');
      if (segment) {
        url += `/${segment}`;
      }
      const bc = route.data['breadcrumb'];
      if (typeof bc === 'string' && bc.length) {
        items.push({ label: bc, link: url });
      }
    }
    if (items.length === 0) {
      const path = this.router.url.split('?')[0];
      const fallback = this.nav.breadcrumbLabelForPath(path);
      if (fallback) {
        items.push({ label: fallback, link: path });
      } else {
        items.push({ label: 'NAV.DASHBOARD', link: '/dashboard' });
      }
    }
    const last = items.length - 1;
    this.breadcrumbs.set(
      items.map((b, i) => (i === last ? { label: b.label } : { label: b.label, link: b.link })),
    );
  }
}
