import { computed, inject, Injectable } from '@angular/core';
import {
  AlertTriangle,
  ArrowRightLeft,
  BarChart3,
  BookOpen,
  Building2,
  Calendar,
  FileBarChart,
  FileInput,
  FolderTree,
  GaugeCircle,
  History,
  LayoutDashboard,
  List,
  MapPin,
  Package,
  Ruler,
  Settings,
  Shield,
  Truck,
  User,
} from 'lucide-angular';
import type { UserRole } from '../models/enums';
import { AuthService } from './auth.service';

/** Lucide icon payload used by `lucide-icon` `[img]`. */
type NavIcon = typeof LayoutDashboard;

export type NavEntry =
  | {
      kind: 'link';
      path: string;
      label: string;
      icon: NavIcon;
      /** When true, only active on exact URL match (e.g. dashboard). */
      pathMatch?: 'full';
      roles?: readonly UserRole[];
    }
  | {
      kind: 'submenu';
      key: string;
      label: string;
      icon: NavIcon;
      roles?: readonly UserRole[];
      children: readonly {
        path: string;
        label: string;
        icon: NavIcon;
        roles?: readonly UserRole[];
      }[];
    };

export interface NavSection {
  heading: string;
  items: readonly NavEntry[];
  roles?: readonly UserRole[];
}

const ADMIN_ROLES: readonly UserRole[] = ['ADMIN', 'SUPER_ADMIN'];

const NAV_SECTIONS: readonly NavSection[] = [
  {
    heading: 'NAV.SECTIONS.MENU',
    items: [
      {
        kind: 'link',
        path: '/dashboard',
        label: 'NAV.DASHBOARD',
        icon: LayoutDashboard,
        pathMatch: 'full',
      },
    ],
  },
  {
    heading: 'NAV.SECTIONS.INVENTORY',
    items: [
      { kind: 'link', path: '/items', label: 'NAV.ITEM_MASTER', icon: List },
      { kind: 'link', path: '/stock', label: 'NAV.STOCK_BALANCES', icon: Package },
      { kind: 'link', path: '/par-levels', label: 'NAV.PAR_LEVELS', icon: GaugeCircle },
      { kind: 'link', path: '/movements', label: 'NAV.MOVEMENTS', icon: Truck },
      { kind: 'link', path: '/ledger', label: 'NAV.LEDGER', icon: BookOpen },
      {
        kind: 'submenu',
        key: 'master-data',
        label: 'NAV.MASTER_DATA',
        icon: FolderTree,
        children: [
          { path: '/departments', label: 'NAV.DEPARTMENTS', icon: Building2 },
          { path: '/suppliers', label: 'NAV.SUPPLIERS', icon: Truck },
          { path: '/categories', label: 'NAV.CATEGORIES', icon: FolderTree },
          { path: '/units-manage', label: 'NAV.UNITS', icon: Ruler },
          { path: '/locations', label: 'NAV.LOCATIONS', icon: MapPin },
        ],
      },
    ],
  },
  {
    heading: 'NAV.SECTIONS.OPERATIONS',
    items: [
      {
        kind: 'submenu',
        key: 'transactions',
        label: 'NAV.TRANSACTIONS',
        icon: ArrowRightLeft,
        children: [
          { path: '/grn', label: 'NAV.GRN_IMPORT', icon: FileInput },
          { path: '/transfers', label: 'NAV.TRANSFERS', icon: ArrowRightLeft },
          { path: '/breakage', label: 'NAV.BREAKAGE_LOSS', icon: AlertTriangle },
          { path: '/get-passes', label: 'NAV.GET_PASS_WORKFLOW', icon: Package },
        ],
      },
    ],
  },
  {
    heading: 'NAV.SECTIONS.REPORTS',
    items: [
      {
        kind: 'submenu',
        key: 'reports',
        label: 'NAV.REPORTS',
        icon: FileBarChart,
        children: [
          { path: '/reports', label: 'NAV.REPORTS', icon: FileBarChart },
          { path: '/stock-report', label: 'NAV.STOCK_REPORT', icon: BarChart3 },
          { path: '/period-close', label: 'NAV.PERIOD_CLOSE', icon: Calendar },
        ],
      },
    ],
  },
  {
    heading: 'NAV.SECTIONS.ADMIN',
    roles: ADMIN_ROLES,
    items: [
      { kind: 'link', path: '/users', label: 'NAV.USERS', icon: User, roles: ADMIN_ROLES },
      { kind: 'link', path: '/audit-log', label: 'NAV.AUDIT_LOG', icon: Shield, roles: ADMIN_ROLES },
      {
        kind: 'link',
        path: '/inventory-history',
        label: 'NAV.INVENTORY_HISTORY',
        icon: History,
        roles: ADMIN_ROLES,
      },
      {
        kind: 'link',
        path: '/settings',
        label: 'NAV.SETTINGS',
        icon: Settings,
        roles: ADMIN_ROLES,
      },
    ],
  },
];

function roleAllowed(
  role: UserRole | undefined,
  allowed: readonly UserRole[] | undefined,
): boolean {
  if (!allowed?.length) {
    return true;
  }
  if (!role) {
    return false;
  }
  return allowed.includes(role);
}

function filterSubmenuChildren<
  T extends { roles?: readonly UserRole[]; path: string; label: string; icon: NavIcon },
>(children: readonly T[], role: UserRole | undefined): T[] {
  return children.filter((c) => roleAllowed(role, c.roles));
}

function filterNavEntry(entry: NavEntry, role: UserRole | undefined): NavEntry | null {
  if (!roleAllowed(role, entry.roles)) {
    return null;
  }
  if (entry.kind === 'link') {
    return entry;
  }
  const children = filterSubmenuChildren(entry.children, role);
  if (!children.length) {
    return null;
  }
  return { ...entry, children };
}

function filterSections(role: UserRole | undefined): NavSection[] {
  const base = NAV_SECTIONS.filter((s) => roleAllowed(role, s.roles))
    .map((section) => ({
      ...section,
      items: section.items.map((i) => filterNavEntry(i, role)).filter((i): i is NavEntry => i !== null),
    }))
    .filter((s) => s.items.length > 0);

  if (role === 'SUPER_ADMIN') {
    base.push({
      heading: 'NAV.SECTIONS.SUPER_ADMIN',
      items: [
        {
          kind: 'link',
          path: '/admin/tenants',
          label: 'NAV.SUPER_ADMIN',
          icon: Shield,
          roles: ['SUPER_ADMIN'],
        },
      ],
    });
  }

  return base;
}

@Injectable({ providedIn: 'root' })
export class NavigationService {
  private readonly auth = inject(AuthService);

  /** Menu tree after role filtering (reacts to `AuthService.currentUser`). */
  readonly sections = computed(() => filterSections(this.auth.currentUser()?.role));

  /** Flat map for breadcrumbs on routes without `data.breadcrumb`. */
  breadcrumbLabelForPath(urlPath: string): string | null {
    const path = urlPath.split('?')[0] ?? urlPath;
    for (const section of NAV_SECTIONS) {
      for (const item of section.items) {
        if (item.kind === 'link' && item.path === path) {
          return item.label;
        }
        if (item.kind === 'submenu') {
          for (const c of item.children) {
            if (c.path === path) {
              return c.label;
            }
          }
        }
      }
    }
    if (path === '/admin' || path.startsWith('/admin/')) {
      return 'NAV.SUPER_ADMIN';
    }
    return null;
  }
}
