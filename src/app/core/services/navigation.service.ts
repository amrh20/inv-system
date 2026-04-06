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
  transferView: 'TRANSFER_VIEW',
  breakageView: 'BREAKAGE_VIEW',
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
      { kind: 'link', path: '/items', label: 'NAV.ITEM_MASTER', icon: List },
      { kind: 'link', path: '/stock', label: 'NAV.STOCK_BALANCES', icon: Package },
      { kind: 'link', path: '/par-levels', label: 'NAV.PAR_LEVELS', icon: GaugeCircle },
      { kind: 'link', path: '/movements', label: 'NAV.MOVEMENTS', icon: Truck },
      { kind: 'link', path: '/ledger', label: 'NAV.LEDGER', icon: BookOpen },
   
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
          {
            path: '/transfers',
            label: 'NAV.TRANSFERS',
            icon: ArrowRightLeft,
            permission: NAV_PERMISSIONS.transferView,
          },
          {
            path: '/breakage',
            label: 'NAV.BREAKAGE_LOSS',
            icon: AlertTriangle,
            permission: NAV_PERMISSIONS.breakageView,
          },
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
  required: string | undefined,
  hasPermission: (permission: string) => boolean,
): boolean {
  if (!required) {
    return true;
  }
  return hasPermission(required);
}

function filterSubmenuChildren<
  T extends { permission?: string; path: string; label: string; icon: NavIcon },
>(children: readonly T[], hasPermission: (permission: string) => boolean): T[] {
  return children.filter((c) => permissionAllowed(c.permission, hasPermission));
}

function filterNavEntry(
  entry: NavEntry,
  hasPermission: (permission: string) => boolean,
): NavEntry | null {
  if (!permissionAllowed(entry.permission, hasPermission)) {
    return null;
  }
  if (entry.kind === 'link') {
    return entry;
  }
  const children = filterSubmenuChildren(entry.children, hasPermission);
  if (!children.length) {
    return null;
  }
  return { ...entry, children };
}

function filterSections(
  orgDashboardOnly: boolean,
  hasPermission: (permission: string) => boolean,
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

  const base = NAV_SECTIONS.filter((s) => permissionAllowed(s.permission, hasPermission))
    .map((section) => ({
      ...section,
      items: section.items
        .map((i) => filterNavEntry(i, hasPermission))
        .filter((i): i is NavEntry => i !== null),
    }))
    .filter((s) => s.items.length > 0);

  if (hasPermission(NAV_PERMISSIONS.superAdminPortalAccess)) {
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
      this.auth.isParentOrganizationContext(),
      (permission) => this.auth.hasPermission(permission),
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
