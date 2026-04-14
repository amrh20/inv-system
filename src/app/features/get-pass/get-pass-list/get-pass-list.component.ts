import { DatePipe, NgClass } from '@angular/common';
import {
  Component,
  computed,
  DestroyRef,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { first } from 'rxjs/operators';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTabChangeEvent, NzTabsModule } from 'ng-zorro-antd/tabs';
import { NzTooltipModule } from 'ng-zorro-antd/tooltip';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { LucideAngularModule } from 'lucide-angular';
import { Eye, Package, Plus, RefreshCw } from 'lucide-angular';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { AuthService } from '../../../core/services/auth.service';
import type { GetPassStatus, GetPassType } from '../../../core/models/enums';
import type { RequirementsResponse } from '../../items/models/item.model';
import { ItemsService } from '../../items/services/items.service';
import type { GetPassListRow } from '../models/get-pass.model';
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
  'PARTIALLY_RETURNED',
  'RETURNED',
  'CLOSED',
  'REJECTED',
];

const TYPE_FILTERS: Array<'ALL' | GetPassType> = ['ALL', 'TEMPORARY', 'CATERING', 'PERMANENT'];

@Component({
  selector: 'app-get-pass-list',
  standalone: true,
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
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly auth = inject(AuthService);

  readonly lucidePkg = Package;
  readonly lucidePlus = Plus;
  readonly lucideRefresh = RefreshCw;
  readonly lucideEye = Eye;

  readonly statusFilters = STATUS_FILTERS;
  readonly typeFilters = TYPE_FILTERS;

  /** 0 = outgoing (this hotel), 1 = incoming (sister hotel → this hotel). */
  readonly listTabIndex = signal(0);

  readonly activeStatus = signal<(typeof STATUS_FILTERS)[number]>('ALL');
  readonly activeType = signal<(typeof TYPE_FILTERS)[number]>('ALL');
  readonly passes = signal<GetPassListRow[]>([]);
  readonly total = signal(0);
  readonly page = signal(1);
  readonly pageSize = 20;
  readonly loading = signal(false);
  readonly listError = signal('');
  /** From `GET /items/check-requirements`; `isOpeningBalanceAllowed` disables New Get Pass during OB setup. */
  readonly requirements = signal<RequirementsResponse | null>(null);
  readonly obStatus = signal<NonNullable<RequirementsResponse['obStatus']>>(
    GetPassListComponent.DEFAULT_OB_STATUS,
  );
  readonly disableCreateButton = computed(() => this.obStatus() === 'INITIAL_LOCK');

  get canCreate(): boolean {
    return this.auth.hasPermission('GET_PASS_CREATE');
  }

  /**
   * Incoming tab: property roles + org-level viewers (parent-org context or ORG_MANAGER)
   * so org managers can see all internal transfers across properties from one screen.
   */
  canViewIncoming(): boolean {
    return (
      this.auth.hasRole('SUPER_ADMIN', 'ADMIN', 'SECURITY', 'GENERAL_MANAGER', 'ORG_MANAGER') ||
      this.auth.isParentOrganizationContext()
    );
  }

  /** Show issuer / receiver columns when listing at organization root (multiple hotels). */
  showOrgWidePropertyColumns(): boolean {
    const t = this.auth.currentTenant();
    const atOrgRoot = t != null && (t.parentId === null || t.parentId === undefined);
    return this.auth.isParentOrganizationContext() || (this.auth.hasRole('ORG_MANAGER') && atOrgRoot);
  }

  ngOnInit(): void {
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
    const index = ev.index ?? 0;
    this.listTabIndex.set(index);
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
    if (this.canViewIncoming() && this.listTabIndex() === 1) {
      this.loadIncoming();
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
          this.passes.set(r.passes);
          this.total.set(r.total);
          this.loading.set(false);
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
          this.passes.set(r.passes);
          this.total.set(r.total);
          this.loading.set(false);
        },
        error: () => {
          this.listError.set(this.translate.instant('GET_PASS.LIST.ERROR_LOAD_INCOMING'));
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

  /**
   * Incoming list: OUT = blue (dispatched), RECEIVED_AT_DESTINATION = amber (at gate / pending dept),
   * destination dept accepted = green (final).
   */
  incomingListStatusClass(p: GetPassListRow): string {
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

  /** Translation key for status label on Incoming tab (destination-specific wording). */
  incomingListStatusLabelKey(p: GetPassListRow): string {
    if (p.destinationDeptAcceptedAt) {
      return 'GET_PASS.LIST.STATUS_INCOMING.RECEIVED_BY_DEPT';
    }
    if (p.status === 'OUT') {
      return 'GET_PASS.LIST.STATUS_INCOMING.OUT';
    }
    if (p.status === 'RECEIVED_AT_DESTINATION') {
      return 'GET_PASS.LIST.STATUS_INCOMING.RECEIVED_AT_DESTINATION';
    }
    return `GET_PASS.STATUS.${p.status}`;
  }

  nextPage(): void {
    const maxPage = Math.max(1, Math.ceil(this.total() / this.pageSize));
    if (this.page() < maxPage) {
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
