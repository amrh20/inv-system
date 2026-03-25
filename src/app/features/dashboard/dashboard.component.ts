import { DatePipe, NgClass } from '@angular/common';
import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { TranslatePipe } from '@ngx-translate/core';
import { LucideAngularModule } from 'lucide-angular';
import {
  Activity,
  AlertTriangle,
  ArrowRightLeft,
  Building2,
  Clock,
  DollarSign,
  FileInput,
  Loader2,
  Package,
  RefreshCw,
  Store,
  TrendingDown,
  Trash2,
  type LucideIconData,
} from 'lucide-angular';
import { AuthService } from '../../core/services/auth.service';
import { DashboardService } from './services/dashboard.service';
import type {
  BranchSummary,
  DashboardSummary,
  InventoryOverview,
  MonthlyPerformance,
  OrganizationDashboardSummary,
  OrganizationGroupTotals,
  RiskIndicators,
  ValueByDepartment,
} from './models/dashboard.model';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';

const fmt = (v: number | undefined | null) =>
  new Intl.NumberFormat('en-SA', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v ?? 0);

const fmtSAR = (v: number | undefined | null) =>
  `SAR ${new Intl.NumberFormat('en-SA', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v ?? 0)}`;

const fmtSARFull = (v: number | undefined | null) =>
  `SAR ${new Intl.NumberFormat('en-SA', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v ?? 0)}`;

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    DatePipe,
    NzButtonModule,
    TranslatePipe,
    LucideAngularModule,
    NgClass,
    EmptyStateComponent,
  ],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent implements OnInit {
  private readonly dashboardApi = inject(DashboardService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly lucideDollarSign = DollarSign;
  readonly lucideStore = Store;
  readonly lucidePackage = Package;
  readonly lucideRefresh = RefreshCw;
  readonly lucideLoader = Loader2;
  readonly lucideAlertTriangle = AlertTriangle;
  readonly lucideArrowRightLeft = ArrowRightLeft;
  readonly lucideTrendingDown = TrendingDown;
  readonly lucideClock = Clock;
  readonly lucideBuilding2 = Building2;
  readonly lucideActivity = Activity;

  readonly data = signal<DashboardSummary | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly responseTimeMs = signal<number | null>(null);
  readonly currentUser = this.auth.currentUser;
  readonly isParentOrganizationContext = computed(() => this.auth.isParentOrganizationContext());
  readonly parentTenantId = computed(() => this.auth.currentTenant()?.id ?? null);

  /** Child hotels / branches for organization comparison view */
  readonly branchSummaries = signal<BranchSummary[]>([]);
  readonly organizationSummary = signal<OrganizationDashboardSummary | null>(null);
  readonly orgLoading = signal(false);
  readonly orgError = signal<string | null>(null);
  readonly switchingBranchSlug = signal<string | null>(null);

  /** Group KPIs: always sum of all rows in `branchSummaries` (API `data` array). */
  readonly orgTotals = computed<OrganizationGroupTotals>(() => {
    const rows = this.branchSummaries();
    return {
      totalInventoryValue: rows.reduce((a, b) => a + (b.inventoryValue ?? 0), 0),
      totalConsumption: rows.reduce((a, b) => a + (b.consumptionValue ?? 0), 0),
      totalPendingTasks: rows.reduce((a, b) => a + (b.pendingTasks ?? 0), 0),
    };
  });

  readonly maxBranchInventory = computed(() => {
    const rows = this.branchSummaries();
    return Math.max(...rows.map((b) => b.inventoryValue ?? 0), 1);
  });

  readonly maxBranchConsumption = computed(() => {
    const rows = this.branchSummaries();
    return Math.max(...rows.map((b) => b.consumptionValue ?? 0), 1);
  });

  readonly maxBranchWaste = computed(() => {
    const rows = this.branchSummaries();
    return Math.max(...rows.map((b) => b.wasteValue ?? 0), 1);
  });

  readonly maxBranchPending = computed(() => {
    const rows = this.branchSummaries();
    return Math.max(...rows.map((b) => b.pendingTasks ?? 0), 1);
  });

  readonly ov = computed<InventoryOverview | null>(() => this.data()?.inventoryOverview ?? null);
  readonly mp = computed<MonthlyPerformance | null>(() => this.data()?.monthlyPerformance ?? null);
  readonly ri = computed<RiskIndicators | null>(() => this.data()?.riskIndicators ?? null);
  readonly oh = computed(() => this.data()?.operationalHealth ?? null);

  readonly valueByDept = computed<ValueByDepartment[]>(() => {
    const vbd = this.ov()?.valueByDepartment;
    return Array.isArray(vbd) ? vbd : [];
  });

  readonly maxDeptValue = computed(() => {
    const arr = this.valueByDept();
    if (arr.length === 0) return 0;
    return Math.max(...arr.map((d) => d.value), 1);
  });

  readonly dateStr = signal('');
  readonly timeStr = signal('');
  /** Current tenant (organization / property) — from auth context, never hardcoded */
  readonly tenantName = computed(() => {
    const ct = this.auth.currentTenant();
    if (ct?.name) {
      return ct.name;
    }
    if (ct?.slug) {
      return ct.slug;
    }
    const u = this.currentUser();
    return u?.tenant?.name ?? u?.tenant?.slug ?? '';
  });

  readonly operationalHealthItems = computed(() => {
    const o = this.oh();
    if (!o) return [];
    return [
      {
        label: 'DASHBOARD.PENDING_TRANSFERS',
        count: o.pendingTransfersCount ?? 0,
        icon: ArrowRightLeft as LucideIconData,
        color: 'indigo',
        link: '/transfers',
      },
      {
        label: 'DASHBOARD.OVERDUE_LOANS',
        count: o.overdueLoansCount ?? 0,
        icon: AlertTriangle as LucideIconData,
        color: 'red',
        link: '/asset-loans',
      },
      {
        label: 'DASHBOARD.PENDING_BREAKAGE',
        count: o.pendingLossCount ?? 0,
        icon: Trash2 as LucideIconData,
        color: 'orange',
        link: '/breakage',
      },
      {
        label: 'DASHBOARD.PENDING_GRNS',
        count: o.pendingGrnsCount ?? 0,
        icon: FileInput as LucideIconData,
        color: 'teal',
        link: '/grn',
      },
      {
        label: 'DASHBOARD.PENDING_STOCK_REPORTS',
        count: o.pendingStockReportsCount ?? 0,
        icon: Activity as LucideIconData,
        color: 'purple',
        link: '/stock-report',
      },
    ];
  });

  constructor() {
    this.updateDateTime();
  }

  ngOnInit() {
    if (this.isParentOrganizationContext()) {
      this.loading.set(false);
      this.orgLoading.set(true);
      this.fetchOrganizationDashboard();
      const interval = setInterval(() => this.updateDateTime(), 60000);
      this.destroyRef.onDestroy(() => clearInterval(interval));
      return;
    }
    this.fetchDashboard();
    const interval = setInterval(() => this.updateDateTime(), 60000);
    this.destroyRef.onDestroy(() => clearInterval(interval));
  }

  private updateDateTime() {
    const now = new Date();
    this.dateStr.set(
      now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
    );
    this.timeStr.set(now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }));
  }

  fetchOrganizationDashboard(): void {
    const parentId = this.parentTenantId();
    if (!parentId) {
      this.orgLoading.set(false);
      this.orgError.set('DASHBOARD.ORG_ERROR_MISSING_PARENT');
      return;
    }
    this.orgLoading.set(true);
    this.orgError.set(null);
    this.dashboardApi
      .getOrganizationSummary(parentId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (payload) => {
          if (!payload) {
            this.organizationSummary.set(null);
            this.branchSummaries.set([]);
            this.orgError.set('DASHBOARD.ORG_ERROR_LOAD');
            this.orgLoading.set(false);
            return;
          }
          const branches = payload.branches ?? [];
          this.organizationSummary.set({ ...payload, branches });
          this.branchSummaries.set(branches);
          this.orgLoading.set(false);
        },
        error: (err) => {
          this.orgError.set(
            err?.error?.message ?? err?.message ?? 'DASHBOARD.ORG_ERROR_LOAD',
          );
          this.organizationSummary.set(null);
          this.branchSummaries.set([]);
          this.orgLoading.set(false);
        },
      });
  }

  viewBranch(tenantSlug: string): void {
    if (!tenantSlug || this.switchingBranchSlug()) {
      return;
    }
    this.switchingBranchSlug.set(tenantSlug);
    this.auth
      .switchTenant(tenantSlug)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.switchingBranchSlug.set(null);
          window.location.href = '/dashboard';
        },
        error: () => {
          this.switchingBranchSlug.set(null);
        },
      });
  }

  fetchDashboard() {
    if (this.isParentOrganizationContext()) {
      this.loading.set(false);
      this.error.set(null);
      this.data.set(null);
      return;
    }

    this.loading.set(true);
    this.error.set(null);
    this.dashboardApi
      .getSummary()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.data.set(res.data);
          this.responseTimeMs.set(res.responseTimeMs);
          this.loading.set(false);
        },
        error: (err) => {
          this.error.set(
            err?.error?.message ?? err?.message ?? 'Failed to load dashboard',
          );
          this.loading.set(false);
        },
      });
  }

  fmt = fmt;
  fmtSAR = fmtSAR;
  fmtSARFull = fmtSARFull;

  agingForBucket(bucket: string): { count: number; value: number } | undefined {
    const aging = this.ri()?.aging ?? [];
    return aging.find((a) => a.bucket === bucket);
  }

  navigateTo(path: string) {
    this.router.navigateByUrl(path);
  }

  isBranchSwitching(slug: string): boolean {
    return this.switchingBranchSlug() === slug;
  }
}
