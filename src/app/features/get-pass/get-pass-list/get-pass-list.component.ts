import { DatePipe, NgClass } from '@angular/common';
import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { first } from 'rxjs/operators';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTabChangeEvent, NzTabsModule } from 'ng-zorro-antd/tabs';
import { NzTooltipModule } from 'ng-zorro-antd/tooltip';
import { NzMessageService } from 'ng-zorro-antd/message';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { LucideAngularModule } from 'lucide-angular';
import { Check, Eye, Package, Plus, RefreshCw } from 'lucide-angular';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { AuthService } from '../../../core/services/auth.service';
import { ConfirmationService } from '../../../core/services/confirmation.service';
import type { GetPassStatus, GetPassType } from '../../../core/models/enums';
import type { RequirementsResponse } from '../../items/models/item.model';
import { ItemsService } from '../../items/services/items.service';
import type { GetPassDiscrepancyRow, GetPassListRow } from '../models/get-pass.model';
import { GetPassService } from '../services/get-pass.service';

const STATUS_FILTERS: Array<'ALL' | GetPassStatus> = [
  'ALL',
  'DRAFT',
  'PENDING_DEPT',
  'PENDING_COST_CONTROL',
  'PENDING_FINANCE',
  'PENDING_GM',
  'PENDING_SECURITY',
  'APPROVED',
  'OUT',
  'RECEIVED_AT_DESTINATION',
  'RETURNING',
  'RETURN_RECEIVED_AT_GATE',
  'PARTIALLY_RETURNED',
  'RETURNED',
  'CLOSED',
  'REJECTED',
];

const TYPE_FILTERS: Array<'ALL' | GetPassType> = [
  'ALL',
  'TEMPORARY',
  'OUTSIDE_CATERING',
  'PERMANENT',
];

@Component({
  selector: 'app-get-pass-list',
  standalone: true,
  providers: [ConfirmationService],
  imports: [
    DatePipe,
    NgClass,
    FormsModule,
    NzAlertModule,
    NzButtonModule,
    NzSelectModule,
    NzTableModule,
    NzTabsModule,
    NzTooltipModule,
    TranslatePipe,
    LucideAngularModule,
    EmptyStateComponent,
  ],
  templateUrl: './get-pass-list.component.html',
  styleUrl: './get-pass-list.component.scss',
})
export class GetPassListComponent implements OnInit {
  private static readonly DEFAULT_OB_STATUS: NonNullable<RequirementsResponse['obStatus']> = 'FINALIZED';

  private readonly api = inject(GetPassService);
  private readonly itemsApi = inject(ItemsService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly auth = inject(AuthService);
  private readonly confirmation = inject(ConfirmationService);
  private readonly message = inject(NzMessageService);

  readonly lucidePkg = Package;
  readonly lucidePlus = Plus;
  readonly lucideRefresh = RefreshCw;
  readonly lucideEye = Eye;
  readonly lucideCheck = Check;

  readonly statusFilters = STATUS_FILTERS;
  readonly typeFilters = TYPE_FILTERS;

  readonly selectedTab = signal<'OUTGOING' | 'INCOMING' | 'RETURNS' | 'CLAIMS'>('OUTGOING');

  readonly activeStatus = signal<(typeof STATUS_FILTERS)[number]>('ALL');
  readonly activeType = signal<(typeof TYPE_FILTERS)[number]>('ALL');
  readonly passes = signal<GetPassListRow[]>([]);
  readonly total = signal(0);
  readonly page = signal(1);
  readonly pageSize = 20;
  readonly loading = signal(false);
  readonly listError = signal('');
  readonly claims = signal<GetPassDiscrepancyRow[]>([]);
  /** From `GET /items/check-requirements`; `isOpeningBalanceAllowed` disables New Get Pass during OB setup. */
  readonly requirements = signal<RequirementsResponse | null>(null);
  readonly obStatus = signal<NonNullable<RequirementsResponse['obStatus']>>(
    GetPassListComponent.DEFAULT_OB_STATUS,
  );
  readonly disableCreateButton = computed(
    () => this.obStatus() === 'INITIAL_LOCK' || this.obStatus() === 'OPEN',
  );
  readonly maxPage = computed(() => Math.max(1, Math.ceil(this.total() / this.pageSize)));

  get canCreate(): boolean {
    return this.auth.hasPermission('GET_PASS_CREATE');
  }

  /**
   * Incoming tab: property roles + org-level viewers (parent-org context or ORG_MANAGER)
   * so org managers can see all internal transfers across properties from one screen.
   */
  canViewIncoming(): boolean {
    return (
      this.auth.hasRole('SUPER_ADMIN', 'ADMIN', 'SECURITY', 'GENERAL_MANAGER', 'ORG_MANAGER', 'DEPT_MANAGER') ||
      this.auth.isParentOrganizationContext()
    );
  }

  canViewClaims(): boolean {
    return this.auth.hasRole('SUPER_ADMIN', 'COST_CONTROL', 'FINANCE_MANAGER');
  }

  availableTabs(): Array<'OUTGOING' | 'INCOMING' | 'RETURNS' | 'CLAIMS'> {
    const tabs: Array<'OUTGOING' | 'INCOMING' | 'RETURNS' | 'CLAIMS'> = ['OUTGOING'];
    if (this.canViewIncoming()) tabs.push('INCOMING');
    if (this.canViewIncoming()) tabs.push('RETURNS');
    if (this.canViewClaims()) tabs.push('CLAIMS');
    return tabs;
  }

  selectedTabIndex(): number {
    return Math.max(0, this.availableTabs().indexOf(this.selectedTab()));
  }

  /** Show issuer / receiver columns when listing at organization root (multiple hotels). */
  showOrgWidePropertyColumns(): boolean {
    const t = this.auth.currentTenant();
    const atOrgRoot = t != null && (t.parentId === null || t.parentId === undefined);
    return this.auth.isParentOrganizationContext() || (this.auth.hasRole('ORG_MANAGER') && atOrgRoot);
  }

  ngOnInit(): void {
    const initialTab = this.route.snapshot.queryParamMap.get('tab');
    if (initialTab === 'OUTGOING' || initialTab === 'INCOMING' || initialTab === 'RETURNS' || initialTab === 'CLAIMS') {
      this.selectedTab.set(initialTab);
    }
    this.loadRequirements();
    this.load();
  }

  private loadRequirements(): void {
    this.itemsApi
      .checkRequirements()
      .pipe(first(), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          if (!res.success || !res.data) {
            this.requirements.set(null);
            this.obStatus.set(GetPassListComponent.DEFAULT_OB_STATUS);
            return;
          }
          const normalizedObStatus =
            res.data.obStatus ??
            (res.data.isOpeningBalanceAllowed ? 'OPEN' : GetPassListComponent.DEFAULT_OB_STATUS);
          this.requirements.set(res.data);
          this.obStatus.set(normalizedObStatus);
        },
        error: () => {
          this.requirements.set(null);
          this.obStatus.set(GetPassListComponent.DEFAULT_OB_STATUS);
        },
      });
  }

  setStatus(s: (typeof STATUS_FILTERS)[number]): void {
    this.activeStatus.set(s);
    this.page.set(1);
    this.load();
  }

  setType(t: (typeof TYPE_FILTERS)[number]): void {
    this.activeType.set(t);
    this.page.set(1);
    this.load();
  }

  onListTabChange(ev: NzTabChangeEvent): void {
    const tabs = this.availableTabs();
    const index = ev.index ?? 0;
    this.selectedTab.set(tabs[index] ?? 'OUTGOING');
    this.page.set(1);
    this.load();
  }

  statusLabel(s: string): string {
    if (s === 'ALL') return this.translate.instant('GET_PASS.LIST.FILTER_ALL_STATUS');
    return this.translate.instant(`GET_PASS.STATUS.${s}`);
  }

  typeLabel(t: string): string {
    if (t === 'ALL') return this.translate.instant('GET_PASS.LIST.FILTER_ALL_TYPES');
    return this.translate.instant(`GET_PASS.TYPE.${t}`);
  }

  load(): void {
    if (this.selectedTab() === 'INCOMING') {
      this.loadIncoming();
    } else if (this.selectedTab() === 'RETURNS') {
      this.loadReturns();
    } else if (this.selectedTab() === 'CLAIMS') {
      this.loadClaims();
    } else {
      this.loadOutgoing();
    }
  }

  private loadOutgoing(): void {
    this.loading.set(true);
    this.listError.set('');
    const st = this.activeStatus() === 'ALL' ? undefined : this.activeStatus();
    const tt = this.activeType() === 'ALL' ? undefined : this.activeType();
    this.api
      .list({
        page: this.page(),
        limit: this.pageSize,
        status: st,
        transferType: tt,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (r) => {
          if (this.handlePaginatedResult(r)) {
            this.loading.set(false);
          }
        },
        error: () => {
          this.listError.set(this.translate.instant('GET_PASS.LIST.ERROR_LOAD'));
          this.loading.set(false);
        },
      });
  }

  private loadIncoming(): void {
    this.loading.set(true);
    this.listError.set('');
    this.api
      .getIncomingPasses({
        page: this.page(),
        limit: this.pageSize,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (r) => {
          if (this.handlePaginatedResult(r)) {
            this.loading.set(false);
          }
        },
        error: () => {
          this.listError.set(this.translate.instant('GET_PASS.LIST.ERROR_LOAD_INCOMING'));
          this.loading.set(false);
        },
      });
  }

  private loadReturns(): void {
    this.loading.set(true);
    this.listError.set('');
    const currentStatus = this.activeStatus();
    const defaultReturnStatuses: GetPassStatus[] = [
      'RETURNING',
      'RETURN_RECEIVED_AT_GATE',
      'PARTIALLY_RETURNED',
      'RETURNED',
    ];
    const statuses: string[] | undefined =
      currentStatus === 'ALL' ? defaultReturnStatuses : [currentStatus as GetPassStatus];
    this.api
      .getReturningPasses({
        page: this.page(),
        limit: this.pageSize,
        status: statuses,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (r) => {
          if (this.handlePaginatedResult(r)) {
            this.loading.set(false);
          }
        },
        error: () => {
          this.listError.set(this.translate.instant('GET_PASS.LIST.ERROR_LOAD'));
          this.loading.set(false);
        },
      });
  }

  private handlePaginatedResult(result: { passes: GetPassListRow[]; total: number }): boolean {
    const total = Math.max(0, Number(result.total) || 0);
    const maxPage = Math.max(1, Math.ceil(total / this.pageSize));

    if (total > 0 && this.page() > maxPage) {
      this.page.set(maxPage);
      this.load();
      return false;
    }

    this.total.set(total);
    this.passes.set(result.passes);
    return true;
  }

  private loadClaims(): void {
    this.loading.set(true);
    this.listError.set('');
    this.api
      .getDiscrepancies()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (rows) => {
          this.claims.set(rows);
          this.total.set(rows.length);
          this.loading.set(false);
        },
        error: () => {
          this.listError.set(this.translate.instant('GET_PASS.LIST.ERROR_LOAD_CLAIMS'));
          this.loading.set(false);
        },
      });
  }

  goNew(): void {
    if (this.disableCreateButton()) {
      return;
    }
    this.router.navigate(['/get-passes/new']);
  }

  goDetail(p: GetPassListRow): void {
    this.router.navigate(['/get-passes', p.id]);
  }

  statusClass(status: GetPassStatus): string {
    switch (status) {
      case 'DRAFT':
      case 'PENDING_DEPT':
      case 'PENDING_COST_CONTROL':
      case 'PENDING_FINANCE':
      case 'PENDING_GM':
      case 'PENDING_SECURITY':
        return 'pending';
      case 'APPROVED':
      case 'OUT':
        return 'processing';
      case 'RECEIVED_AT_DESTINATION':
        return 'success';
      case 'RETURNING':
      case 'RETURN_RECEIVED_AT_GATE':
        return 'pending';
      case 'PARTIALLY_RETURNED':
        return 'low-stock';
      case 'RETURNED':
      case 'CLOSED':
        return 'success';
      case 'REJECTED':
        return 'rejected';
      default:
        return 'pending';
    }
  }

  statusBadgeClass(p: GetPassListRow): string {
    if (p.isOverdue) {
      return 'status-rejected';
    }
    return `status-${this.statusClass(p.status)}`;
  }

  statusLabelKey(p: GetPassListRow): string {
    if (p.isOverdue) {
      return 'GET_PASS.STATUS.OVERDUE';
    }
    if (p.status === 'RETURNING') {
      const viewerTenantId = this.auth.currentTenantId();
      const sourceTenantId = p.tenantId ?? p.tenant?.id ?? p.sourceTenantId ?? p.sourceTenant?.id ?? null;
      const targetTenantId = p.targetTenantId ?? p.targetTenant?.id ?? null;
      if (viewerTenantId && sourceTenantId && viewerTenantId === sourceTenantId) {
        return 'GET_PASS.STATUS.RETURNING_AWAITING_ARRIVAL';
      }
      if (viewerTenantId && targetTenantId && viewerTenantId === targetTenantId) {
        return 'GET_PASS.STATUS.RETURNING_IN_TRANSIT';
      }
    }
    return `GET_PASS.STATUS.${p.status}`;
  }

  transferTypeBadgeClass(transferType: GetPassType): string {
    return transferType === 'PERMANENT' ? 'status-processing' : 'status-pending';
  }

  /**
   * Incoming list: OUT = blue (dispatched), RECEIVED_AT_DESTINATION = amber (at gate / pending dept),
   * destination dept accepted = green (final).
   */
  incomingListStatusClass(p: GetPassListRow): string {
    if (p.isOverdue) {
      return 'rejected';
    }
    if (p.status === 'RETURNING') {
      return 'pending';
    }
    if (p.status === 'RETURN_RECEIVED_AT_GATE') {
      return 'pending';
    }
    if (p.destinationDeptAcceptedAt) {
      return 'success';
    }
    switch (p.status) {
      case 'OUT':
        return 'processing';
      case 'RECEIVED_AT_DESTINATION':
        return 'pending';
      default:
        return this.statusClass(p.status);
    }
  }

  returnsListStatusClass(p: GetPassListRow): string {
    if (p.isOverdue) {
      return 'rejected';
    }
    if (p.status === 'RETURNING') {
      return 'pending';
    }
    if (p.status === 'RETURN_RECEIVED_AT_GATE') {
      return 'pending';
    }
    return this.statusClass(p.status);
  }

  canQuickConfirmReturnArrival(p: GetPassListRow): boolean {
    // Return arrival now requires per-line inspection payload, handled in detail screen modal.
    // Keep quick action hidden from list.
    return false;
  }

  quickConfirmReturnArrival(p: GetPassListRow): void {
    this.goDetail(p);
  }

  /** Translation key for status label on Incoming tab (destination-specific wording). */
  incomingListStatusLabelKey(p: GetPassListRow): string {
    if (p.isOverdue) {
      return 'GET_PASS.STATUS.OVERDUE';
    }
    if (p.status === 'RETURNING') {
      return this.statusLabelKey(p);
    }
    if (p.destinationDeptAcceptedAt) {
      return 'GET_PASS.LIST.STATUS_INCOMING.RECEIVED_BY_DEPT';
    }
    if (p.status === 'OUT') {
      return 'GET_PASS.STATUS.PENDING_ARRIVAL';
    }
    if (p.status === 'RECEIVED_AT_DESTINATION') {
      return 'GET_PASS.LIST.STATUS_INCOMING.RECEIVED_AT_DESTINATION';
    }
    return `GET_PASS.STATUS.${p.status}`;
  }

  nextPage(): void {
    if (this.page() < this.maxPage()) {
      this.page.update((p) => p + 1);
      this.load();
    }
  }

  prevPage(): void {
    if (this.page() > 1) {
      this.page.update((p) => p - 1);
      this.load();
    }
  }
}
