import { Routes } from '@angular/router';
import {
  BREAKAGE_NAV_PERMISSIONS_ANY,
  LOST_ITEMS_NAV_PERMISSIONS_ANY,
} from './core/constants/approvals-nav-permissions';
import { authGuard } from './core/guards/auth.guard';
import { blockSuperAdminDashboardGuard } from './core/guards/block-super-admin-dashboard.guard';
import { permissionGuard } from './core/guards/permission.guard';
import { defaultRedirectGuard } from './core/guards/super-admin-redirect.guard';
import { requireSuperAdminGuard } from './core/guards/require-super-admin.guard';
import { grnCreateCanDeactivateGuard } from './features/grn/grn-create/grn-create-can-deactivate.guard';

const ROUTE_PERMISSIONS = {
  usersCompanyManage: 'USERS_COMPANY_MANAGE',
  auditLogView: 'AUDIT_LOG_VIEW',
  inventoryView: 'INVENTORY_VIEW',
  breakageView: 'BREAKAGE_VIEW',
  lostItemsView: 'LOST_ITEMS_VIEW',
  settingsManage: 'SETTINGS_MANAGE',
  grnView: 'GRN_VIEW',
  viewDashboard: 'VIEW_DASHBOARD',
} as const;

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () =>
      import('./features/auth/login/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'forgot-password',
    loadComponent: () =>
      import('./features/auth/forgot-password/forgot-password.component').then(
        (m) => m.ForgotPasswordComponent,
      ),
  },
  {
    path: 'reset-password',
    loadComponent: () =>
      import('./features/auth/reset-password/reset-password.component').then(
        (m) => m.ResetPasswordComponent,
      ),
  },
  {
    path: 'admin',
    canActivate: [authGuard, requireSuperAdminGuard],
    loadComponent: () =>
      import('./features/admin/super-admin-layout/super-admin-layout.component').then(
        (m) => m.SuperAdminLayoutComponent,
      ),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'tenants' },
      {
        path: 'tenants',
        loadComponent: () =>
          import('./features/admin/tenants-list/tenants-list.component').then(
            (m) => m.TenantsListComponent,
          ),
        data: { breadcrumb: 'SUPER_ADMIN.HOTEL_MANAGEMENT' },
      },
      {
        path: 'logs',
        loadComponent: () =>
          import('./features/admin/super-admin-logs/super-admin-logs.component').then(
            (m) => m.SuperAdminLogsComponent,
          ),
        data: { breadcrumb: 'SUPER_ADMIN.AUDIT_LOG' },
      },
    ],
  },
  {
    path: '',
    canActivate: [authGuard, blockSuperAdminDashboardGuard],
    loadComponent: () =>
      import('./core/layout/main-layout/main-layout.component').then((m) => m.MainLayoutComponent),
    children: [
      {
        path: '',
        pathMatch: 'full',
        canActivate: [defaultRedirectGuard],
        loadComponent: () =>
          import('./core/pages/default-redirect/default-redirect.component').then(
            (m) => m.DefaultRedirectComponent,
          ),
      },
      {
        path: 'dashboard',
        canActivate: [permissionGuard],
        loadComponent: () =>
          import('./features/dashboard/dashboard.component').then((m) => m.DashboardComponent),
        data: { breadcrumb: 'NAV.DASHBOARD', permission: ROUTE_PERMISSIONS.viewDashboard },
      },
      {
        path: 'items/new',
        loadComponent: () =>
          import('./features/items/item-form/item-form.component').then((m) => m.ItemFormComponent),
        data: { breadcrumb: 'ITEM_FORM.NEW_ITEM' },
      },
      {
        path: 'items/:id/edit',
        loadComponent: () =>
          import('./features/items/item-form/item-form.component').then((m) => m.ItemFormComponent),
        data: { breadcrumb: 'ITEM_FORM.EDIT_ITEM' },
      },
      {
        path: 'items',
        loadComponent: () =>
          import('./features/items/items-list/items-list.component').then((m) => m.ItemsListComponent),
        data: { breadcrumb: 'NAV.ITEM_MASTER' },
      },
      {
        path: 'inventory',
        loadComponent: () =>
          import('./features/inventory/inventory-layout.component').then((m) => m.InventoryLayoutComponent),
        children: [
          {
            path: '',
            pathMatch: 'full',
            loadComponent: () =>
              import('./features/inventory/inventory.component').then((m) => m.InventoryComponent),
            data: { breadcrumb: 'NAV.INVENTORY' },
          },
          {
            path: 'items/import',
            loadComponent: () =>
              import('./features/items/item-import/item-import.component').then((m) => m.ItemImportComponent),
            data: { breadcrumb: 'NAV.ITEM_IMPORT' },
          },
          {
            path: 'grn/new',
            canActivate: [permissionGuard],
            data: { breadcrumb: 'GRN.CREATE.PAGE_TITLE', permission: 'GRN_MANAGE' },
            loadComponent: () =>
              import('./features/grn/grn-create/grn-create.component').then((m) => m.GrnCreateComponent),
            canDeactivate: [grnCreateCanDeactivateGuard],
          },
          {
            path: 'ledger',
            pathMatch: 'full',
            redirectTo: '/ledger',
          },
        ],
      },
      {
        path: 'stock',
        canActivate: [permissionGuard],
        loadComponent: () =>
          import('./features/stock/stock-balances/stock-balances.component').then(
            (m) => m.StockBalancesComponent,
          ),
        data: { breadcrumb: 'NAV.STOCK_BALANCES', permission: ROUTE_PERMISSIONS.inventoryView },
      },
      {
        path: 'par-levels',
        loadComponent: () =>
          import('./features/par-levels/par-levels-list/par-levels-list.component').then(
            (m) => m.ParLevelsListComponent,
          ),
        data: { breadcrumb: 'NAV.PAR_LEVELS' },
      },
      {
        path: 'movements',
        children: [
          {
            path: '',
            loadComponent: () =>
              import('./features/movements/movement-list/movement-list.component').then(
                (m) => m.MovementListComponent,
              ),
            data: { breadcrumb: 'NAV.MOVEMENTS' },
          },
          {
            path: 'new',
            loadComponent: () =>
              import('./features/movements/movement-form/movement-form.component').then(
                (m) => m.MovementFormComponent,
              ),
            data: { breadcrumb: 'MOVEMENTS.NEW_MOVEMENT' },
          },
          {
            path: ':id',
            loadComponent: () =>
              import('./features/movements/movement-form/movement-form.component').then(
                (m) => m.MovementFormComponent,
              ),
            data: { breadcrumb: 'MOVEMENTS.DOCUMENT' },
          },
        ],
      },
      {
        path: 'ledger',
        loadComponent: () =>
          import('./features/ledger/ledger-viewer/ledger-viewer.component').then(
            (m) => m.LedgerViewerComponent,
          ),
        data: { breadcrumb: 'NAV.LEDGER' },
      },
      {
        path: 'master-data',
        loadComponent: () =>
          import('./core/pages/master-data-shell/master-data-shell.component').then(
            (m) => m.MasterDataShellComponent,
          ),
        children: [
          { path: 'units', pathMatch: 'full', redirectTo: '/units-manage' },
          { path: 'suppliers', pathMatch: 'full', redirectTo: '/suppliers' },
          { path: 'categories', pathMatch: 'full', redirectTo: '/categories' },
          { path: 'locations', pathMatch: 'full', redirectTo: '/locations' },
        ],
      },
      {
        path: 'departments',
        loadComponent: () =>
          import('./features/master-data/departments/departments-list/departments-list.component').then(
            (m) => m.DepartmentsListComponent,
          ),
        data: { breadcrumb: 'NAV.DEPARTMENTS' },
      },
      {
        path: 'suppliers',
        loadComponent: () =>
          import('./features/master-data/suppliers/suppliers-list/suppliers-list.component').then(
            (m) => m.SuppliersListComponent,
          ),
        data: { breadcrumb: 'NAV.SUPPLIERS' },
      },
      {
        path: 'categories',
        loadComponent: () =>
          import('./features/master-data/categories/categories-list/categories-list.component').then(
            (m) => m.CategoriesListComponent,
          ),
        data: { breadcrumb: 'NAV.CATEGORIES' },
      },
      {
        path: 'units-manage',
        loadComponent: () =>
          import('./features/master-data/units/units-list/units-list.component').then(
            (m) => m.UnitsListComponent,
          ),
        data: { breadcrumb: 'NAV.UNITS' },
      },
      {
        path: 'locations',
        loadComponent: () =>
          import('./features/master-data/locations/locations-list/locations-list.component').then(
            (m) => m.LocationsListComponent,
          ),
        data: { breadcrumb: 'NAV.LOCATIONS' },
      },
      {
        path: 'grn',
        canActivate: [permissionGuard],
        data: { permission: ROUTE_PERMISSIONS.grnView },
        children: [
          {
            path: '',
            loadComponent: () =>
              import('./features/grn/grn-list/grn-list.component').then((m) => m.GrnListComponent),
            data: { breadcrumb: 'GRN.LIST.TITLE' },
          },
          {
            path: ':id',
            loadComponent: () =>
              import('./features/grn/grn-detail/grn-detail.component').then((m) => m.GrnDetailComponent),
            data: { breadcrumb: 'GRN.DETAIL.TITLE' },
          },
        ],
      },
      {
        path: 'breakage',
        canActivate: [permissionGuard],
        data: {
          permissionsAny: [...BREAKAGE_NAV_PERMISSIONS_ANY],
        },
        children: [
          {
            path: '',
            loadComponent: () =>
              import('./features/breakage/breakage-list/breakage-list.component').then(
                (m) => m.BreakageListComponent,
              ),
            data: { breadcrumb: 'BREAKAGE.LIST.TITLE' },
          },
          {
            path: ':id',
            loadComponent: () =>
              import('./features/breakage/breakage-detail/breakage-detail.component').then(
                (m) => m.BreakageDetailComponent,
              ),
            data: { breadcrumb: 'BREAKAGE.DETAIL.BREADCRUMB' },
          },
        ],
      },
      {
        path: 'lost-items',
        canActivate: [permissionGuard],
        data: {
          permissionsAny: [...LOST_ITEMS_NAV_PERMISSIONS_ANY],
        },
        children: [
          {
            path: '',
            loadComponent: () =>
              import('./features/lost-items/lost-items-list/lost-items-list.component').then(
                (m) => m.LostItemsListComponent,
              ),
            data: { breadcrumb: 'LOST_ITEMS.LIST.TITLE' },
          },
          {
            path: ':id',
            loadComponent: () =>
              import('./features/lost-items/lost-items-detail/lost-items-detail.component').then(
                (m) => m.LostItemsDetailComponent,
              ),
            data: { breadcrumb: 'LOST_ITEMS.DETAIL.BREADCRUMB' },
          },
        ],
      },
      {
        path: 'get-passes',
        children: [
          {
            path: '',
            loadComponent: () =>
              import('./features/get-pass/get-pass-list/get-pass-list.component').then(
                (m) => m.GetPassListComponent,
              ),
            data: { breadcrumb: 'GET_PASS.LIST.TITLE' },
          },
          {
            path: 'new',
            loadComponent: () =>
              import('./features/get-pass/get-pass-form/get-pass-form.component').then(
                (m) => m.GetPassFormComponent,
              ),
            data: { breadcrumb: 'GET_PASS.FORM.NEW_TITLE' },
          },
          {
            path: ':id/edit',
            loadComponent: () =>
              import('./features/get-pass/get-pass-form/get-pass-form.component').then(
                (m) => m.GetPassFormComponent,
              ),
            data: { breadcrumb: 'GET_PASS.FORM.EDIT_TITLE' },
          },
          {
            path: ':id',
            loadComponent: () =>
              import('./features/get-pass/get-pass-detail/get-pass-detail.component').then(
                (m) => m.GetPassDetailComponent,
              ),
            data: { breadcrumb: 'GET_PASS.DETAIL.BREADCRUMB' },
          },
        ],
      },
      {
        path: 'transfers',
        children: [
          {
            path: '',
            loadComponent: () =>
              import('./features/transfers/transfer-list/transfer-list.component').then(
                (m) => m.TransferListComponent,
              ),
            data: { breadcrumb: 'TRANSFER.LIST.TITLE' },
          },
          {
            path: 'new',
            loadComponent: () =>
              import('./features/transfers/transfer-form/transfer-form.component').then(
                (m) => m.TransferFormComponent,
              ),
            data: { breadcrumb: 'TRANSFER.FORM.NEW_TITLE' },
          },
          {
            path: ':id/edit',
            loadComponent: () =>
              import('./features/transfers/transfer-form/transfer-form.component').then(
                (m) => m.TransferFormComponent,
              ),
            data: { breadcrumb: 'TRANSFER.FORM.EDIT_TITLE' },
          },
          {
            path: ':id',
            loadComponent: () =>
              import('./features/transfers/transfer-detail/transfer-detail.component').then(
                (m) => m.TransferDetailComponent,
              ),
            data: { breadcrumb: 'TRANSFER.DETAIL.BREADCRUMB' },
          },
        ],
      },
      {
        path: 'reports',
        loadComponent: () =>
          import('./features/reports/reports-layout/reports-layout.component').then((m) => m.ReportsLayoutComponent),
        data: { breadcrumb: 'NAV.REPORTS' },
        children: [
          { path: '', pathMatch: 'full', redirectTo: 'summary' },
          {
            path: 'summary',
            loadComponent: () =>
              import('./features/reports/summary-inventory-report/summary-inventory-report.component').then(
                (m) => m.SummaryInventoryReportComponent,
              ),
            data: { breadcrumb: 'REPORTS.BREADCRUMB_SUMMARY' },
          },
          {
            path: 'detail',
            loadComponent: () =>
              import('./features/reports/report-engine/report-engine.component').then((m) => m.ReportEngineComponent),
            data: { breadcrumb: 'REPORTS.BREADCRUMB_DETAIL', reportType: 'DETAIL' },
          },
          {
            path: 'breakage',
            loadComponent: () =>
              import('./features/reports/report-engine/report-engine.component').then((m) => m.ReportEngineComponent),
            data: { breadcrumb: 'REPORTS.BREADCRUMB_BREAKAGE', reportType: 'BREAKAGE' },
          },
          {
            path: 'omc',
            loadComponent: () =>
              import('./features/reports/report-engine/report-engine.component').then((m) => m.ReportEngineComponent),
            data: { breadcrumb: 'REPORTS.BREADCRUMB_OMC', reportType: 'OMC' },
          },
          {
            path: 'transfers',
            loadComponent: () =>
              import('./features/reports/report-engine/report-engine.component').then((m) => m.ReportEngineComponent),
            data: { breadcrumb: 'REPORTS.BREADCRUMB_TRANSFERS', reportType: 'TRANSFERS' },
          },
          {
            path: 'aging',
            loadComponent: () =>
              import('./features/reports/report-engine/report-engine.component').then((m) => m.ReportEngineComponent),
            data: { breadcrumb: 'REPORTS.BREADCRUMB_AGING', reportType: 'AGING' },
          },
          {
            path: 'valuation',
            loadComponent: () =>
              import('./features/reports/valuation-report/valuation-report.component').then(
                (m) => m.ValuationReportComponent,
              ),
            data: { breadcrumb: 'REPORTS.BREADCRUMB_VALUATION' },
          },
        ],
      },
      {
        path: 'stock-report',
        children: [
          {
            path: '',
            loadComponent: () =>
              import('./features/stock-report/stock-report-page/stock-report-page.component').then(
                (m) => m.StockReportPageComponent,
              ),
            data: { breadcrumb: 'NAV.STOCK_REPORT' },
          },
          {
            path: ':id',
            loadComponent: () =>
              import('./features/stock-report/stock-report-detail/stock-report-detail.component').then(
                (m) => m.StockReportDetailComponent,
              ),
            data: { breadcrumb: 'STOCK_REPORT.DETAIL.BREADCRUMB' },
          },
        ],
      },
      {
        path: 'period-close',
        loadComponent: () =>
          import('./features/period-close/period-close-page/period-close-page.component').then(
            (m) => m.PeriodClosePageComponent,
          ),
        data: { breadcrumb: 'NAV.PERIOD_CLOSE' },
      },
      {
        path: 'users',
        canActivate: [permissionGuard],
        loadComponent: () =>
          import('./features/admin/users/users-list/users-list.component').then((m) => m.UsersListComponent),
        data: { breadcrumb: 'NAV.USERS', permission: ROUTE_PERMISSIONS.usersCompanyManage },
      },
      {
        path: 'audit-log',
        canActivate: [permissionGuard],
        loadComponent: () =>
          import('./features/admin/audit-log/audit-log-page/audit-log-page.component').then(
            (m) => m.AuditLogPageComponent,
          ),
        data: { breadcrumb: 'NAV.AUDIT_LOG', permission: ROUTE_PERMISSIONS.auditLogView },
      },
      {
        path: 'inventory-history',
        canActivate: [permissionGuard],
        loadComponent: () =>
          import('./features/admin/inventory-history/inventory-history-page/inventory-history-page.component').then(
            (m) => m.InventoryHistoryPageComponent,
          ),
        data: { breadcrumb: 'NAV.INVENTORY_HISTORY', permission: ROUTE_PERMISSIONS.inventoryView },
      },
      {
        path: 'settings',
        canActivate: [permissionGuard],
        loadComponent: () =>
          import('./features/admin/settings/settings-page/settings-page.component').then(
            (m) => m.SettingsPageComponent,
          ),
        data: { breadcrumb: 'NAV.SETTINGS', permission: ROUTE_PERMISSIONS.settingsManage },
      },
      {
        path: 'forbidden',
        loadComponent: () =>
          import('./core/pages/forbidden/forbidden.component').then((m) => m.ForbiddenComponent),
        data: { breadcrumb: 'FORBIDDEN.PAGE_TITLE' },
      },
      {
        path: '**',
        loadComponent: () =>
          import('./core/pages/coming-soon/coming-soon.component').then((m) => m.ComingSoonComponent),
      },
    ],
  },
  { path: '**', redirectTo: '/login' },
];
