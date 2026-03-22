import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () =>
      import('./features/auth/login/login.component').then((m) => m.LoginComponent),
  },
  {
    path: '',
    loadComponent: () =>
      import('./core/layout/main-layout/main-layout.component').then((m) => m.MainLayoutComponent),
    canActivate: [authGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
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
        path: 'admin',
        loadComponent: () =>
          import('./core/pages/coming-soon/coming-soon.component').then((m) => m.ComingSoonComponent),
        data: { breadcrumb: 'NAV.SUPER_ADMIN' },
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
        path: '**',
        loadComponent: () =>
          import('./core/pages/coming-soon/coming-soon.component').then((m) => m.ComingSoonComponent),
      },
    ],
  },
  { path: '**', redirectTo: '/login' },
];
