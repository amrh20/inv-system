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
  DashboardSummary,
  InventoryOverview,
  MonthlyPerformance,
  RiskIndicators,
  ValueByDepartment,
} from './models/dashboard.model';

const fmt = (v: number | undefined | null) =>
  new Intl.NumberFormat('en-SA', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v ?? 0);

const fmtSAR = (v: number | undefined | null) =>
  `SAR ${new Intl.NumberFormat('en-SA', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v ?? 0)}`;

const fmtSARFull = (v: number | undefined | null) =>
  `SAR ${new Intl.NumberFormat('en-SA', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v ?? 0)}`;

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [DatePipe, NzButtonModule, TranslatePipe, LucideAngularModule, NgClass],
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

  readonly data = signal<DashboardSummary | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly responseTimeMs = signal<number | null>(null);
  readonly currentUser = this.auth.currentUser;

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
  readonly tenantName = computed(() => {
    const u = this.currentUser();
    const tenant = u?.tenant;
    return tenant?.name ?? 'Grand Horizon Hotel';
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

  fetchDashboard() {
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
}
