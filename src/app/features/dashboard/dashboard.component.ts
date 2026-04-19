import { DatePipe, NgClass, NgIf } from '@angular/common';
import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzSkeletonModule } from 'ng-zorro-antd/skeleton';
import { NzTooltipModule } from 'ng-zorro-antd/tooltip';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { LucideAngularModule } from 'lucide-angular';
import {
  Activity,
  AlertTriangle,
  ArrowRightLeft,
  Bell,
  Building2,
  Check,
  ClipboardList,
  Clock,
  DollarSign,
  FileInput,
  KeyRound,
  LayoutGrid,
  Loader2,
  Package,
  Box,
  RefreshCw,
  Search,
  Store,
  TrendingDown,
  Trash2,
  User,
  type LucideIconData,
} from 'lucide-angular';
import { LOST_ITEMS_NAV_PERMISSIONS_ANY } from '../../core/constants/approvals-nav-permissions';
import { AuthService } from '../../core/services/auth.service';
import { SubscriptionNoticeService } from '../../core/services/subscription-notice.service';
import {
  getSubscriptionExpiredMessage,
  isSubscriptionExpiredHttpError,
} from '../../core/utils/subscription-http-error.util';
import { DashboardService } from './services/dashboard.service';
import type {
  BranchSummary,
  ControlTowerSummary,
  DashboardProfile,
  DashboardSummary,
  InventoryOverview,
  MonthlyPerformance,
  OrganizationDashboardSummary,
  OrganizationGroupTotals,
  RiskIndicators,
  TopVulnerableItem,
  ValueByDepartment,
} from './models/dashboard.model';
import type { EmptyStateIcon } from '../../shared/components/empty-state/empty-state.component';
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
    NzCardModule,
    NzDrawerModule,
    NzSkeletonModule,
    NzTooltipModule,
    TranslatePipe,
    LucideAngularModule,
    NgClass,
    NgIf,
    EmptyStateComponent,
  ],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent implements OnInit {
  private static readonly PERMISSION_DASHBOARD_ANALYTICS = 'DASHBOARD_VIEW';

  /** Defaults when `controlTower` is omitted or partial — keeps chart bindings safe. */
  private static readonly CONTROL_TOWER_EMPTY: ControlTowerSummary = {
    monthlyApprovedLosses: { totalValue: 0, documentCount: 0 },
    workflowHealth: [],
    stockAlerts: [],
    accountabilityDistribution: {
      companyLoss: 0,
      employeeDeduction: 0,
      targetHotelCompensation: 0,
      unspecified: 0,
    },
    lossVsBreakage: { breakageValue: 0, lostValue: 0 },
    topVulnerableItems: [],
    pendingMyActionCount: 0,
    activeUsersCount: 0,
  };
  private readonly dashboardApi = inject(DashboardService);
  private readonly auth = inject(AuthService);
  private readonly subscriptionNotice = inject(SubscriptionNoticeService);
  private readonly router = inject(Router);
  private readonly translate = inject(TranslateService);
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
  readonly lucideBell = Bell;
  readonly lucideUser = User;
  readonly lucideClipboardList = ClipboardList;
  readonly lucideCheck = Check;
  readonly lucideSearch = Search;
  readonly lucideKeyRound = KeyRound;
  readonly lucideLayoutGrid = LayoutGrid;
  readonly lucideBox = Box;
  /** Empty-chart illustration (minimal search icon) — passed to `app-empty-state`. */
  readonly emptyChartIllustration = Search as EmptyStateIcon;

  readonly data = signal<DashboardSummary | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  /** Subscription expired: show soft empty state; modal handled globally / on first API error. */
  readonly subscriptionBlocked = signal(false);
  readonly responseTimeMs = signal<number | null>(null);
  readonly currentUser = this.auth.currentUser;

  /** JWT `DASHBOARD_VIEW` — load analytics API and adaptive layout (replaces legacy admin-only gate). */
  readonly hasAnalyticsAccess = computed(() => this.auth.hasPermission(DashboardComponent.PERMISSION_DASHBOARD_ANALYTICS));
  userName = '';
  /**
   * Welcome entrance animation. Must be a `signal` so updates after `setTimeout` run change
   * detection in this zoneless app (plain `boolean` would stay invisible at `opacity-0`).
   */
  readonly isVisible = signal(false);

  /** Mobile quick actions: FAB + bottom sheet (viewports under 768px). */
  readonly quickSheetOpen = signal(false);
  readonly isMobileQuickUi = signal(false);

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

  /** Server-provided profile, or inferred from role when missing (older responses). */
  readonly dashboardProfile = computed((): DashboardProfile => {
    const m = this.data()?.meta?.dashboardProfile;
    if (m === 'executive' || m === 'operations' || m === 'department' || m === 'security') {
      return m;
    }
    return this.inferDashboardProfileFromRole(this.auth.userRole());
  });

  /** Translation key under `COMMON.ROLES` for the role ribbon. */
  readonly roleRibbonKey = computed(() => {
    const r = (this.auth.userRole() || '').trim();
    if (!r) return 'COMMON.ROLES.USER';
    return `COMMON.ROLES.${r}`;
  });

  readonly isExecutiveDashboard = computed(() => this.dashboardProfile() === 'executive');
  readonly isOperationsDashboard = computed(() => this.dashboardProfile() === 'operations');
  readonly isDepartmentDashboard = computed(() => this.dashboardProfile() === 'department');
  readonly isSecurityDashboard = computed(() => this.dashboardProfile() === 'security');

  /** Total breakage/lost documents created by the user (department profile). */
  readonly myRequestsTotal = computed(() => {
    const rows = this.data()?.myRequestStatus ?? [];
    return rows.reduce((a, b) => a + (b.count ?? 0), 0);
  });

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

  /**
   * Normalized Control Tower with `[]` defaults — use for all chart/KPI bindings after load.
   * When summary has no `controlTower`, returns the empty shell so the analytics hub still renders.
   */
  readonly controlTowerResolved = computed((): ControlTowerSummary | null => {
    const d = this.data();
    if (!d) return null;
    if (d.meta?.dashboardProfile === 'security' || d.securitySnapshot != null) {
      return null;
    }
    const ct = d.controlTower;
    if (!ct) {
      return { ...DashboardComponent.CONTROL_TOWER_EMPTY };
    }
    return {
      ...DashboardComponent.CONTROL_TOWER_EMPTY,
      ...ct,
      monthlyApprovedLosses: {
        ...DashboardComponent.CONTROL_TOWER_EMPTY.monthlyApprovedLosses,
        ...ct.monthlyApprovedLosses,
      },
      workflowHealth: ct.workflowHealth ?? [],
      stockAlerts: ct.stockAlerts ?? [],
      topVulnerableItems: ct.topVulnerableItems ?? [],
      lossVsBreakage: {
        ...DashboardComponent.CONTROL_TOWER_EMPTY.lossVsBreakage,
        ...ct.lossVsBreakage,
      },
      accountabilityDistribution: {
        ...DashboardComponent.CONTROL_TOWER_EMPTY.accountabilityDistribution,
        ...ct.accountabilityDistribution,
      },
    };
  });

  /**
   * True when there is meaningful inventory or analytics activity (not a greenfield month/property).
   * When false, chart areas show the guided empty state and the Report breakage action pulses.
   */
  readonly hasData = computed(() => {
    const d = this.data();
    if (!d) return false;

    if (d.securitySnapshot) {
      return (
        (d.securitySnapshot.pendingGateApprovals ?? 0) > 0 ||
        (d.securitySnapshot.activeOutPasses ?? 0) > 0
      );
    }

    const ov = d.inventoryOverview;
    if (
      (ov?.totalValue ?? 0) > 0 ||
      (ov?.totalQtyOnHand ?? 0) > 0 ||
      (ov?.totalActiveItems ?? 0) > 0
    ) {
      return true;
    }

    const ct = this.controlTowerResolved();
    if (ct) {
      if ((ct.pendingApprovalsPreview?.length ?? 0) > 0) return true;
      if ((ct.monthlyApprovedLosses?.totalValue ?? 0) > 0) return true;
      if ((ct.pendingMyActionCount ?? 0) > 0) return true;
      if ((ct.topVulnerableItems?.length ?? 0) > 0) return true;
      if (
        (ct.lossVsBreakage?.breakageValue ?? 0) + (ct.lossVsBreakage?.lostValue ?? 0) >
        0
      ) {
        return true;
      }
      if ((ct.stockAlerts?.length ?? 0) > 0) return true;
      if ((ct.workflowHealth ?? []).some((w) => w.count > 0)) return true;
      const a = ct.accountabilityDistribution;
      if (
        a &&
        a.companyLoss + a.employeeDeduction + a.targetHotelCompensation + a.unspecified >
          0.005
      ) {
        return true;
      }
    }

    const mp = d.monthlyPerformance;
    if (mp && ((mp.transfersCount ?? 0) > 0 || (mp.lossValue ?? 0) > 0)) {
      return true;
    }

    if ((d.myRequestStatus?.length ?? 0) > 0) {
      return true;
    }

    const vbd = Array.isArray(ov?.valueByDepartment) ? ov.valueByDepartment : [];
    if (vbd.some((x) => x.value > 0)) return true;

    const ri = d.riskIndicators;
    if ((ri?.topSlow?.length ?? 0) > 0) return true;
    if ((ri?.aging ?? []).some((a) => a.count > 0)) return true;

    return false;
  });

  readonly maxVulnerableCost = computed(() => {
    const rows = this.controlTowerResolved()?.topVulnerableItems ?? [];
    if (rows.length === 0) return 1;
    return Math.max(...rows.map((r) => r.totalCost), 1);
  });

  readonly lossBreakageDonutStyle = computed(() => {
    const lb = this.controlTowerResolved()?.lossVsBreakage;
    const b = lb?.breakageValue ?? 0;
    const l = lb?.lostValue ?? 0;
    const t = b + l;
    if (t <= 0) {
      return 'conic-gradient(var(--color-surface-muted, #e5e7eb) 0deg 360deg)';
    }
    const bpct = (b / t) * 100;
    const lpct = (l / t) * 100;
    const deepBlue = 'var(--color-brand-primary, #4f46e5)';
    const softRed = 'var(--color-brand-error, #dc2626)';
    return `conic-gradient(${deepBlue} 0% ${bpct}%, ${softRed} ${bpct}% ${bpct + lpct}%)`;
  });

  readonly accountabilityRows = computed(() => {
    const a = this.controlTowerResolved()?.accountabilityDistribution;
    if (!a) return [];
    return [
      { key: 'COMPANY', labelKey: 'DASHBOARD.ACCOUNTABILITY_COMPANY_LOSS', value: a.companyLoss, cls: 'dashboard-page__acc--company' },
      { key: 'EMPLOYEE', labelKey: 'DASHBOARD.ACCOUNTABILITY_EMPLOYEE', value: a.employeeDeduction, cls: 'dashboard-page__acc--employee' },
      { key: 'TARGET', labelKey: 'DASHBOARD.ACCOUNTABILITY_TARGET_HOTEL', value: a.targetHotelCompensation, cls: 'dashboard-page__acc--target' },
      { key: 'UNSPEC', labelKey: 'DASHBOARD.ACCOUNTABILITY_UNSPECIFIED', value: a.unspecified, cls: 'dashboard-page__acc--unspecified' },
    ];
  });

  readonly accountabilityMax = computed(() => {
    const rows = this.accountabilityRows();
    return Math.max(...rows.map((r) => r.value), 1);
  });

  readonly accountabilityAny = computed(() => {
    const a = this.controlTowerResolved()?.accountabilityDistribution;
    if (!a) return false;
    return (
      a.companyLoss + a.employeeDeduction + a.targetHotelCompensation + a.unspecified > 0.005
    );
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
    const user = this.auth.currentUser();
    if (user) {
      const full = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
      this.userName = full || user.email || '';
    }

    const visibilityTimer = window.setTimeout(() => {
      this.isVisible.set(true);
    }, 50);

    const interval = setInterval(() => this.updateDateTime(), 60000);
    this.applyMobileQuickUiFlag();
    const onResize = (): void => {
      this.applyMobileQuickUiFlag();
      this.onDashboardChartsResize();
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', onResize, { passive: true });
    }
    this.destroyRef.onDestroy(() => {
      clearInterval(interval);
      clearTimeout(visibilityTimer);
      if (typeof window !== 'undefined') {
        window.removeEventListener('resize', onResize);
      }
    });

    if (!this.hasAnalyticsAccess()) {
      this.loading.set(false);
      this.orgLoading.set(false);
      return;
    }

    if (this.isParentOrganizationContext()) {
      this.loading.set(false);
      this.orgLoading.set(true);
      this.fetchOrganizationDashboard();
      return;
    }
    this.fetchDashboard();
  }

  private applyMobileQuickUiFlag(): void {
    if (typeof window === 'undefined') {
      return;
    }
    this.isMobileQuickUi.set(window.innerWidth < 768);
  }

  /**
   * Hook for responsive chart hosts (CSS handles layout; call `chart.resize()` here when ECharts is added).
   */
  private onDashboardChartsResize(): void {
    // Intentionally empty: wire ngx-echarts / echarts `resize()` when charts are introduced.
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
          if (isSubscriptionExpiredHttpError(err)) {
            this.orgError.set(null);
            this.organizationSummary.set(null);
            this.branchSummaries.set([]);
            this.orgLoading.set(false);
            this.subscriptionBlocked.set(true);
            this.subscriptionNotice.showExpiredNotice(getSubscriptionExpiredMessage(err));
            return;
          }
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
          if (isSubscriptionExpiredHttpError(err)) {
            this.error.set(null);
            this.data.set(null);
            this.loading.set(false);
            this.subscriptionBlocked.set(true);
            this.subscriptionNotice.showExpiredNotice(getSubscriptionExpiredMessage(err));
            return;
          }
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

  vulnerableBarPct(row: TopVulnerableItem): number {
    const max = this.maxVulnerableCost();
    if (max <= 0) return 0;
    return Math.min(100, (row.totalCost / max) * 100);
  }

  vulnerableTooltip(row: TopVulnerableItem): string {
    const cost = this.fmtSAR(row.totalCost);
    const n = row.eventCount;
    const ev = this.translate.instant('DASHBOARD.VULNERABLE_EVENTS');
    return `${cost} — ${n} ${ev}`;
  }

  workflowStatusDisplay(status: string): string {
    const s = (status ?? '').trim();
    const key = `DASHBOARD.WORKFLOW_STATUS.${s}`;
    const t = this.translate.instant(key);
    if (!t || t === key) return s;
    return t;
  }

  goQuickBreakage(): void {
    this.quickSheetOpen.set(false);
    this.router.navigate(['/breakage'], { queryParams: { create: '1' } });
  }

  goQuickLost(): void {
    this.quickSheetOpen.set(false);
    this.router.navigate(['/lost-items'], { queryParams: { create: '1' } });
  }

  goStockAudit(): void {
    this.quickSheetOpen.set(false);
    this.router.navigateByUrl('/stock');
  }

  goGetPass(): void {
    this.quickSheetOpen.set(false);
    this.router.navigateByUrl('/get-passes');
  }

  showQuickBreakage(): boolean {
    return this.auth.hasPermission('BREAKAGE_CREATE');
  }

  showQuickLost(): boolean {
    if (!this.auth.hasPermission('BREAKAGE_CREATE')) return false;
    return LOST_ITEMS_NAV_PERMISSIONS_ANY.some((p) => this.auth.hasPermission(p));
  }

  showQuickStockAudit(): boolean {
    return this.auth.hasPermission('STOCK_COUNT_MANAGE') || this.auth.hasPermission('STOCK_COUNT_VIEW');
  }

  showQuickGetPass(): boolean {
    return this.auth.hasPermission('GET_PASS_VIEW');
  }

  private inferDashboardProfileFromRole(role: string): DashboardProfile {
    const r = (role || '').toUpperCase();
    if (['SUPER_ADMIN', 'ORG_MANAGER', 'ADMIN', 'GENERAL_MANAGER', 'FINANCE_MANAGER', 'AUDITOR'].includes(r)) {
      return 'executive';
    }
    if (['STOREKEEPER', 'COST_CONTROL'].includes(r)) return 'operations';
    if (r === 'DEPT_MANAGER') return 'department';
    if (r === 'SECURITY') return 'security';
    return 'executive';
  }

  isBranchSwitching(slug: string): boolean {
    return this.switchingBranchSlug() === slug;
  }
}
