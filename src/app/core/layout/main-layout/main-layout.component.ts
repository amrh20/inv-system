import { Component, DestroyRef, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { filter, merge, of } from 'rxjs';
import { map } from 'rxjs/operators';
import { NzLayoutModule } from 'ng-zorro-antd/layout';
import { NzMenuModule } from 'ng-zorro-antd/menu';
import { NzBreadCrumbModule } from 'ng-zorro-antd/breadcrumb';
import { NzDropDownModule } from 'ng-zorro-antd/dropdown';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTooltipModule } from 'ng-zorro-antd/tooltip';
import { LucideAngularModule } from 'lucide-angular';
import { Check, ChevronDown, Languages, LogOut, Menu, Moon, Search, Sun, X } from 'lucide-angular';
import { AuthService } from '../../services/auth.service';
import { NavigationService, type NavEntry } from '../../services/navigation.service';
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
    NzMenuModule,
    NzBreadCrumbModule,
    NzDropDownModule,
    NzButtonModule,
    NzInputModule,
    NzSpinModule,
    NzTooltipModule,
    LucideAngularModule,
    FormsModule,
    TranslatePipe,
  ],
  templateUrl: './main-layout.component.html',
  styleUrl: './main-layout.component.scss',
})
export class MainLayoutComponent {
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  readonly auth = inject(AuthService);
  readonly nav = inject(NavigationService);
  readonly language = inject(LanguageService);

  readonly sidebarExpanded = signal(true);
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

  private readonly currentUrl = toSignal(
    merge(
      of(this.router.url),
      this.router.events.pipe(
        filter((e): e is NavigationEnd => e instanceof NavigationEnd),
        map(() => this.router.url),
      ),
    ),
    { initialValue: this.router.url },
  );

  readonly pathOnly = () => {
    const u = this.currentUrl() ?? '';
    return u.split('?')[0] ?? u;
  };

  private submenuOpenByKey(): {
    'master-data': boolean;
    transactions: boolean;
    reports: boolean;
  } {
    const p = this.pathOnly();
    return {
      'master-data': this.matchesPrefixes(p, [
        '/departments',
        '/suppliers',
        '/categories',
        '/units-manage',
        '/locations',
      ]),
      transactions: this.matchesPrefixes(p, [
        '/grn',
        '/transfers',
        '/breakage',
        '/get-passes',
      ]),
      reports: this.matchesPrefixes(p, ['/reports', '/stock-report', '/period-close']),
    };
  }

  submenuOpenFor(key: string): boolean {
    // When sidebar is collapsed, never keep submenus "open" — prevents popup from
    // staying visible and blocking reopen (NG-ZORRO #5348).
    if (!this.sidebarExpanded()) {
      return false;
    }
    const map = this.submenuOpenByKey();
    if (key === 'master-data') {
      return map['master-data'];
    }
    if (key === 'transactions') {
      return map.transactions;
    }
    if (key === 'reports') {
      return map.reports;
    }
    return false;
  }

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
      .subscribe(() => this.refreshBreadcrumbs());

    this.refreshBreadcrumbs();
  }

  trackEntry(item: NavEntry): string {
    return item.kind === 'link' ? item.path : item.key;
  }

  toggleSidebar(): void {
    const next = !this.sidebarExpanded();
    this.sidebarExpanded.set(next);
  }

  /** Keep state in sync when nz-sider emits collapsed changes (e.g. breakpoint, internal updates). */
  onSiderCollapsedChange(collapsed: boolean): void {
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
    const user = this.auth.currentUser();
    return (user?.memberships ?? []).filter(
      (membership) => !!membership.tenantId && !!membership.tenantSlug,
    );
  }

  showTenantSwitcher(): boolean {
    return !this.isSuperAdmin() && this.tenantSwitcherItems().length > 0;
  }

  onSwitchTenant(tenantSlug: string): void {
    if (!tenantSlug || this.switchingTenant() || this.isTenantSlugActive(tenantSlug)) {
      return;
    }
    this.switchingTenant.set(true);
    this.auth.switchTenant(tenantSlug).subscribe({
      next: () => {
        this.switchingTenant.set(false);
        window.location.href = '/dashboard';
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

  private matchesPrefixes(path: string, prefixes: string[]): boolean {
    return prefixes.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
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
