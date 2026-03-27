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
import { AuthService } from './auth.service';

/** Lucide icon payload used by `lucide-icon` `[img]`. */
type NavIcon = typeof LayoutDashboard;

const NAV_PERMISSIONS = {
  inventoryView: 'INVENTORY_VIEW',
  grnView: 'GRN_VIEW',
  reportsView: 'REPORTS_VIEW',
  settingsManage: 'SETTINGS_MANAGE',
  usersCompanyManage: 'USERS_COMPANY_MANAGE',
  auditLogView: 'AUDIT_LOG_VIEW',
  superAdminPortalAccess: 'SUPER_ADMIN_PORTAL_ACCESS',
} as const;

export type NavEntry =
  | {
      kind: 'link';
      path: string;
      label: string;
      icon: NavIcon;
      /** When true, only active on exact URL match (e.g. dashboard). */
      pathMatch?: 'full';
      permission?: string;
    }
  | {
      kind: 'submenu';
      key: string;
      label: string;
      icon: NavIcon;
      permission?: string;
      children: readonly {
        path: string;
        label: string;
        icon: NavIcon;
        permission?: string;
      }[];
    };

export interface NavSection {
  heading: string;
  items: readonly NavEntry[];
  permission?: string;
}

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
    permission: NAV_PERMISSIONS.inventoryView,
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
        permission: NAV_PERMISSIONS.inventoryView,
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
          {
            path: '/grn',
            label: 'NAV.GRN_IMPORT',
            icon: FileInput,
            permission: NAV_PERMISSIONS.grnView,
          },
          { path: '/transfers', label: 'NAV.TRANSFERS', icon: ArrowRightLeft },
          { path: '/breakage', label: 'NAV.BREAKAGE_LOSS', icon: AlertTriangle },
          { path: '/get-passes', label: 'NAV.GET_PASS_WORKFLOW', icon: Package },
        ],
      },
    ],
  },
  {
    heading: 'NAV.SECTIONS.REPORTS',
    permission: NAV_PERMISSIONS.reportsView,
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
    items: [
      {
        kind: 'link',
        path: '/users',
        label: 'NAV.USERS',
        icon: User,
        permission: NAV_PERMISSIONS.usersCompanyManage,
      },
      {
        kind: 'link',
        path: '/audit-log',
        label: 'NAV.AUDIT_LOG',
        icon: Shield,
        permission: NAV_PERMISSIONS.auditLogView,
      },
      {
        kind: 'link',
        path: '/inventory-history',
        label: 'NAV.INVENTORY_HISTORY',
        icon: History,
        permission: NAV_PERMISSIONS.inventoryView,
      },
      {
        kind: 'link',
        path: '/settings',
        label: 'NAV.SETTINGS',
        icon: Settings,
        permission: NAV_PERMISSIONS.settingsManage,
      },
    ],
  },
];

function permissionAllowed(
  permissions: readonly string[],
  required: string | undefined,
  isSuperAdmin: boolean,
): boolean {
  if (!required) {
    return true;
  }
  if (permissions.includes(required)) {
    return true;
  }
  return isSuperAdmin;
}

function filterSubmenuChildren<
  T extends { permission?: string; path: string; label: string; icon: NavIcon },
>(children: readonly T[], permissions: readonly string[], isSuperAdmin: boolean): T[] {
  return children.filter((c) => permissionAllowed(permissions, c.permission, isSuperAdmin));
}

function filterNavEntry(
  entry: NavEntry,
  permissions: readonly string[],
  isSuperAdmin: boolean,
): NavEntry | null {
  if (!permissionAllowed(permissions, entry.permission, isSuperAdmin)) {
    return null;
  }
  if (entry.kind === 'link') {
    return entry;
  }
  const children = filterSubmenuChildren(entry.children, permissions, isSuperAdmin);
  if (!children.length) {
    return null;
  }
  return { ...entry, children };
}

function filterSections(
  permissions: readonly string[],
  orgDashboardOnly: boolean,
  isSuperAdmin: boolean,
): NavSection[] {
  if (orgDashboardOnly) {
    return [
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
    ];
  }

  const base = NAV_SECTIONS.filter((s) => permissionAllowed(permissions, s.permission, isSuperAdmin))
    .map((section) => ({
      ...section,
      items: section.items
        .map((i) => filterNavEntry(i, permissions, isSuperAdmin))
        .filter((i): i is NavEntry => i !== null),
    }))
    .filter((s) => s.items.length > 0);

  if (
    isSuperAdmin ||
    permissions.includes(NAV_PERMISSIONS.superAdminPortalAccess)
  ) {
    base.push({
      heading: 'NAV.SECTIONS.SUPER_ADMIN',
      items: [
        {
          kind: 'link',
          path: '/admin/tenants',
          label: 'NAV.SUPER_ADMIN',
          icon: Shield,
          permission: NAV_PERMISSIONS.superAdminPortalAccess,
        },
      ],
    });
  }

  return base;
}

@Injectable({ providedIn: 'root' })
export class NavigationService {
  private readonly auth = inject(AuthService);

  /** Menu tree after permission filtering (reacts to `AuthService.permissions`). */
  readonly sections = computed(() =>
    filterSections(
      this.auth.permissions(),
      this.auth.isParentOrganizationContext(),
      this.auth.currentUser()?.role === 'SUPER_ADMIN',
    ),
  );

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
