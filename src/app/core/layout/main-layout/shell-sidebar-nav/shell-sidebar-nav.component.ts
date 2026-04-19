import { Component, computed, inject, input, output } from '@angular/core';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { merge, of } from 'rxjs';
import { filter, map } from 'rxjs/operators';
import { NzMenuModule } from 'ng-zorro-antd/menu';
import { NzTooltipModule } from 'ng-zorro-antd/tooltip';
import { LucideAngularModule } from 'lucide-angular';
import { LogOut, Moon, Sun } from 'lucide-angular';
import { TranslatePipe } from '@ngx-translate/core';
import { AuthService } from '../../../services/auth.service';
import { NavigationService, type NavEntry } from '../../../services/navigation.service';

@Component({
  selector: 'app-shell-sidebar-nav',
  standalone: true,
  imports: [RouterLink, NzMenuModule, NzTooltipModule, LucideAngularModule, TranslatePipe],
  templateUrl: './shell-sidebar-nav.component.html',
  styleUrl: './shell-sidebar-nav.component.scss',
  host: {
    '[class]': 'hostClass()',
  },
})
export class ShellSidebarNavComponent {
  private readonly router = inject(Router);
  readonly auth = inject(AuthService);
  readonly nav = inject(NavigationService);

  /** When true, sider shows icon-only / collapsed menu. */
  readonly collapsed = input(false);
  /** Extra class on host for drawer-specific touch targets / padding. */
  readonly variant = input<'sider' | 'drawer'>('sider');

  readonly isDarkMode = input(false);

  readonly themeToggle = output<void>();
  readonly logoutClick = output<void>();

  readonly hostClass = computed(() => {
    const v = this.variant();
    return v === 'drawer' ? 'shell-sidebar-nav shell-sidebar-nav--drawer' : 'shell-sidebar-nav';
  });

  readonly lucideMoon = Moon;
  readonly lucideSun = Sun;
  readonly lucideLogOut = LogOut;

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

  private pathOnly(): string {
    const u = this.currentUrl() ?? '';
    return u.split('?')[0] ?? u;
  }

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
        '/lost-items',
        '/get-passes',
      ]),
      reports: this.matchesPrefixes(p, ['/reports', '/stock-report', '/period-close']),
    };
  }

  submenuOpenFor(key: string): boolean {
    if (!this.expandedForSubmenus()) {
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

  /** Full labels + submenus open when not collapsed, or always in mobile drawer. */
  private readonly expandedForSubmenus = computed(() => !this.collapsed());

  trackEntry(item: NavEntry): string {
    return item.kind === 'link' ? item.path : item.key;
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

  private matchesPrefixes(path: string, prefixes: string[]): boolean {
    return prefixes.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
  }
}
