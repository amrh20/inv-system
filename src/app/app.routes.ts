import { Routes } from '@angular/router';
import { adminSectionGuard } from './core/guards/admin-section.guard';
import { authGuard } from './core/guards/auth.guard';
import { blockSuperAdminDashboardGuard } from './core/guards/block-super-admin-dashboard.guard';
import { defaultRedirectGuard } from './core/guards/super-admin-redirect.guard';
import { requireSuperAdminGuard } from './core/guards/require-super-admin.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () =>
      import('./features/auth/login/login.component').then((m) => m.LoginComponent),
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
        loadComponent: () =>
          import('./features/dashboard/dashboard.component').then((m) => m.DashboardComponent),
        data: { breadcrumb: 'NAV.DASHBOARD' },
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
          import('./features/inventory/inventory.component').then((m) => m.InventoryComponent),
        data: { breadcrumb: 'NAV.INVENTORY' },
      },
      {
        path: 'stock',
        loadComponent: () =>
          import('./features/stock/stock-balances/stock-balances.component').then(
            (m) => m.StockBalancesComponent,
          ),
        data: { breadcrumb: 'NAV.STOCK_BALANCES' },
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
        canActivate: [adminSectionGuard],
        loadComponent: () =>
          import('./features/admin/users/users-list/users-list.component').then((m) => m.UsersListComponent),
        data: { breadcrumb: 'NAV.USERS', roles: ['ADMIN', 'ORG_MANAGER', 'SUPER_ADMIN'] },
      },
      {
        path: 'audit-log',
        canActivate: [adminSectionGuard],
        loadComponent: () =>
          import('./features/admin/audit-log/audit-log-page/audit-log-page.component').then(
            (m) => m.AuditLogPageComponent,
          ),
        data: { breadcrumb: 'NAV.AUDIT_LOG', roles: ['ADMIN', 'ORG_MANAGER', 'SUPER_ADMIN'] },
      },
      {
        path: 'inventory-history',
        canActivate: [adminSectionGuard],
        loadComponent: () =>
          import('./features/admin/inventory-history/inventory-history-page/inventory-history-page.component').then(
            (m) => m.InventoryHistoryPageComponent,
          ),
        data: { breadcrumb: 'NAV.INVENTORY_HISTORY', roles: ['ADMIN', 'ORG_MANAGER', 'SUPER_ADMIN'] },
      },
      {
        path: 'settings',
        canActivate: [adminSectionGuard],
        loadComponent: () =>
          import('./features/admin/settings/settings-page/settings-page.component').then(
            (m) => m.SettingsPageComponent,
          ),
        data: { breadcrumb: 'NAV.SETTINGS', roles: ['ADMIN', 'ORG_MANAGER', 'SUPER_ADMIN'] },
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
