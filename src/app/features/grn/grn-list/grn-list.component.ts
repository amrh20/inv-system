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
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import { distinctUntilChanged, first, map, skip } from 'rxjs/operators';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDropDownModule } from 'ng-zorro-antd/dropdown';
import { NzMenuModule } from 'ng-zorro-antd/menu';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTooltipModule } from 'ng-zorro-antd/tooltip';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import {
  EllipsisVertical,
  Eye,
  FileText,
  LucideAngularModule,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
} from 'lucide-angular';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import type { GrnStatus } from '../../../core/models/enums';
import type { RequirementsResponse } from '../../items/models/item.model';
import { ItemsService } from '../../items/services/items.service';
import { grnStatusI18nSuffix, type GrnListRow } from '../models/grn.model';
import { GrnService } from '../services/grn.service';
import { AuthService } from '../../../core/services/auth.service';
import { ConfirmationService } from '../../../core/services/confirmation.service';

const GRN_CREATE_ALLOWED_ROLES = new Set([
  'COST_CONTROL',
  'STOREKEEPER',
  'ADMIN',
  'SUPER_ADMIN',
]);

/** List tabs: `All` or backend status filter (Pending tab → VALIDATED). */
export type GrnListTab = 'All' | 'VALIDATED' | 'APPROVED' | 'POSTED' | 'REJECTED';

const TABS: GrnListTab[] = ['All', 'VALIDATED', 'APPROVED', 'POSTED', 'REJECTED'];

@Component({
  selector: 'app-grn-list',
  standalone: true,
  providers: [ConfirmationService],
  imports: [
    DatePipe,
    NgClass,
    NzAlertModule,
    NzButtonModule,
    NzDropDownModule,
    NzMenuModule,
    NzTableModule,
    NzTooltipModule,
    TranslatePipe,
    LucideAngularModule,
    EmptyStateComponent,
  ],
  templateUrl: './grn-list.component.html',
  styleUrl: './grn-list.component.scss',
})
export class GrnListComponent implements OnInit {
  private static readonly DEFAULT_OB_STATUS: NonNullable<RequirementsResponse['obStatus']> = 'FINALIZED';

  private readonly grnApi = inject(GrnService);
  private readonly itemsApi = inject(ItemsService);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly confirmation = inject(ConfirmationService);
  private readonly message = inject(NzMessageService);

  readonly lucideFileText = FileText;
  readonly lucidePlus = Plus;
  readonly lucideRefresh = RefreshCw;
  readonly lucideEllipsis = EllipsisVertical;
  readonly lucideEye = Eye;
  readonly lucidePencil = Pencil;
  readonly lucideTrash = Trash2;

  readonly tabs = TABS;

  readonly activeTab = signal<GrnListTab>('All');

  /** Wide enough for rejected tab extra columns; horizontal scroll on narrow viewports. */
  readonly grnTableScrollX = computed(() =>
    this.activeTab() === 'REJECTED' ? '1520px' : '1180px',
  );
  readonly grns = signal<GrnListRow[]>([]);
  readonly total = signal(0);
  readonly loading = signal(false);
  readonly listError = signal('');
  readonly tabCounts = signal({ all: 0, validated: 0, approved: 0, posted: 0, rejected: 0 });
  /** From `GET /items/check-requirements`; `isOpeningBalanceAllowed` disables New GRN during OB setup. */
  readonly requirements = signal<RequirementsResponse | null>(null);
  readonly obStatus = signal<NonNullable<RequirementsResponse['obStatus']>>(
    GrnListComponent.DEFAULT_OB_STATUS,
  );

  readonly isAuthorizedRole = computed(() =>
    GRN_CREATE_ALLOWED_ROLES.has(this.authService.userRole()),
  );

  readonly showCreateButton = this.isAuthorizedRole;

  readonly disableCreateButton = computed(
    () => this.obStatus() !== 'FINALIZED',
  );

  readonly showObRequiredBanner = computed(
    () => this.obStatus() === 'INITIAL_LOCK' || this.obStatus() === 'OPEN',
  );

  readonly canManageGrn = computed(() => this.authService.hasPermission('GRN_MANAGE'));

  /** Review / approve-reject UI: Cost Control and Admin only, VALIDATED GRNs. */
  readonly canShowReviewAction = computed(() =>
    this.authService.hasRole('COST_CONTROL', 'ADMIN'),
  );

  ngOnInit(): void {
    this.loadRequirements();
    const tabQ = this.route.snapshot.queryParamMap.get('tab');
    if (tabQ && (TABS as readonly string[]).includes(tabQ)) {
      this.activeTab.set(tabQ as GrnListTab);
    }
    this.route.queryParamMap
      .pipe(
        map((q) => q.get('tab')),
        distinctUntilChanged(),
        skip(1),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((tab) => {
        if (tab && (TABS as readonly string[]).includes(tab)) {
          this.activeTab.set(tab as GrnListTab);
          this.load();
        }
      });
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
            this.obStatus.set(GrnListComponent.DEFAULT_OB_STATUS);
            return;
          }
          const normalizedObStatus =
            res.data.obStatus ??
            (res.data.isOpeningBalanceAllowed ? 'OPEN' : GrnListComponent.DEFAULT_OB_STATUS);
          this.requirements.set(res.data);
          this.obStatus.set(normalizedObStatus);
        },
        error: () => {
          this.requirements.set(null);
          this.obStatus.set(GrnListComponent.DEFAULT_OB_STATUS);
        },
      });
  }

  setTab(tab: GrnListTab): void {
    this.activeTab.set(tab);
    this.load();
  }

  tabLabel(tab: GrnListTab): string {
    if (tab === 'All') return this.translate.instant('GRN.LIST.TAB_ALL');
    if (tab === 'VALIDATED') return this.translate.instant('GRN.STATUS.PENDING');
    return this.translate.instant(`GRN.STATUS.${tab}`);
  }

  tabBadgeCount(tab: GrnListTab): number {
    const c = this.tabCounts();
    switch (tab) {
      case 'All':
        return c.all;
      case 'VALIDATED':
        return c.validated;
      case 'APPROVED':
        return c.approved;
      case 'POSTED':
        return c.posted;
      case 'REJECTED':
        return c.rejected;
    }
  }

  statusLabelSuffix(status: GrnStatus): string {
    return grnStatusI18nSuffix(status);
  }

  load(): void {
    this.loading.set(true);
    this.listError.set('');
    const status = this.activeTab() === 'All' ? undefined : this.activeTab();
    this.grnApi
      .list(status ? { status } : {})
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (r) => {
          this.grns.set(r.grns);
          this.total.set(r.total);
          this.loading.set(false);
          this.refreshTabCounts();
        },
        error: () => {
          this.listError.set(this.translate.instant('GRN.LIST.ERROR_LOAD'));
          this.loading.set(false);
        },
      });
  }

  private refreshTabCounts(): void {
    const countOpts = { page: 1, limit: 1 };
    forkJoin({
      all: this.grnApi.list(countOpts),
      validated: this.grnApi.list({ ...countOpts, status: 'VALIDATED' }),
      approved: this.grnApi.list({ ...countOpts, status: 'APPROVED' }),
      posted: this.grnApi.list({ ...countOpts, status: 'POSTED' }),
      rejected: this.grnApi.list({ ...countOpts, status: 'REJECTED' }),
    }).subscribe({
      next: (r) => {
        this.tabCounts.set({
          all: r.all.total,
          validated: r.validated.total,
          approved: r.approved.total,
          posted: r.posted.total,
          rejected: r.rejected.total,
        });
      },
      error: () => {
        /* keep previous counts */
      },
    });
  }

  openCreate(): void {
    void this.router.navigate(['/inventory/grn/new']);
  }

  goToDetail(grn: GrnListRow, event?: Event): void {
    event?.stopPropagation();
    void this.router.navigate(['/grn', grn.id]);
  }

  canShowEdit(grn: GrnListRow): boolean {
    return grn.status === 'REJECTED';
  }

  primaryRowActionLabel(grn: GrnListRow): string {
    if (this.canShowReviewAction() && grn.status === 'VALIDATED') {
      return this.translate.instant('GRN.LIST.REVIEW_ACTION');
    }
    return this.translate.instant('GRN.LIST.VIEW');
  }

  rejectedByDisplay(grn: GrnListRow): string {
    const u = grn.rejectedByUser;
    if (!u) return '—';
    return [u.firstName, u.lastName].filter(Boolean).join(' ').trim() || '—';
  }

  canDelete(grn: GrnListRow): boolean {
    return grn.status === 'DRAFT';
  }

  rowMenuItemCount(grn: GrnListRow): number {
    let n = 1;
    if (this.canManageGrn() && this.canShowEdit(grn)) n++;
    if (this.canManageGrn() && this.canDelete(grn)) n++;
    return n;
  }

  onDeleteClick(grn: GrnListRow, event: Event): void {
    event.stopPropagation();
    if (!this.canDelete(grn)) return;
    this.confirmation
      .confirm({
        title: this.translate.instant('GRN.LIST.CONFIRM_DELETE_TITLE'),
        message: this.translate.instant('GRN.LIST.CONFIRM_DELETE_MESSAGE', {
          number: grn.grnNumber,
        }),
        confirmText: this.translate.instant('COMMON.DELETE'),
        cancelText: this.translate.instant('COMMON.CANCEL'),
        confirmDanger: true,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((ok) => {
        if (!ok) return;
        this.grnApi
          .delete(grn.id)
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe({
            next: () => {
              this.message.success(this.translate.instant('GRN.LIST.DELETE_OK'));
              this.load();
            },
            error: (err: { error?: { message?: string } }) => {
              this.message.error(
                err?.error?.message ?? this.translate.instant('GRN.LIST.DELETE_FAIL'),
              );
            },
          });
      });
  }

  statusClass(status: GrnListRow['status']): string {
    switch (status) {
      case 'DRAFT':
        return 'draft';
      case 'VALIDATED':
      case 'PENDING_APPROVAL':
        return 'processing';
      case 'APPROVED':
        return 'success';
      case 'POSTED':
        return 'posted';
      case 'REJECTED':
        return 'rejected';
      default:
        return 'pending';
    }
  }
}
