import { DatePipe, NgClass } from '@angular/common';
import {
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  OnInit,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Observable, Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDropdownModule } from 'ng-zorro-antd/dropdown';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMenuModule } from 'ng-zorro-antd/menu';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTooltipModule } from 'ng-zorro-antd/tooltip';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { LucideAngularModule } from 'lucide-angular';
import { Check, EllipsisVertical, Eye, PackageX, Plus, RefreshCw, Search } from 'lucide-angular';
import { AuthService } from '../../../core/services/auth.service';
import { HasPermissionDirective } from '../../../core/directives/has-permission.directive';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { ReturnsWorkflowApproveModalComponent } from '../../../shared/components/returns-workflow-approve-modal/returns-workflow-approve-modal.component';
import type { ReturnsAccountabilityType } from '../../../shared/models/returns-accountability.model';
import {
  type ReturnsWorkflowDocumentContext,
  type ReturnsWorkflowListStatusTab,
  returnsWorkflowListApiStatusParam,
  returnsWorkflowListRowWaitingTagRole,
  returnsWorkflowListShouldFilterCreatedBy,
  returnsWorkflowListTabTranslationSuffix,
  returnsWorkflowUnifiedListApiStatusParam,
  showReturnsWorkflowStatusTabBar,
  userCanActOnReturnsWorkflowListRow,
  visibleReturnsWorkflowListStatusTabs,
  filterReturnsWorkflowListTabsBySource,
  WORKFLOW_PERMISSION_APPROVE_LOST,
} from '../../../shared/utils/returns-workflow.helpers';
import type { LostDetail, LostItemsListRow, LostSourceType, LostWorkflowStatus } from '../models/lost-items.model';
import { LostItemsService } from '../services/lost-items.service';
import { LostCreateModalComponent } from '../lost-create-modal/lost-create-modal.component';
import { injectMatchMinWidth } from '../../../shared/utils/viewport-media';

const SOURCE_TABS: LostSourceType[] = ['INTERNAL', 'GET_PASS_RETURN'];

@Component({
  selector: 'app-lost-items-list',
  standalone: true,
  imports: [
    DatePipe,
    NgClass,
    FormsModule,
    NzAlertModule,
    NzButtonModule,
    NzDropdownModule,
    NzInputModule,
    NzMenuModule,
    NzTableModule,
    NzTagModule,
    NzTooltipModule,
    TranslatePipe,
    LucideAngularModule,
    HasPermissionDirective,
    EmptyStateComponent,
    LostCreateModalComponent,
    ReturnsWorkflowApproveModalComponent,
    RouterLink,
  ],
  templateUrl: './lost-items-list.component.html',
  styleUrl: './lost-items-list.component.scss',
})
export class LostItemsListComponent implements OnInit {
  private listViewReady = false;
  private createFromQueryHandled = false;

  private readonly api = inject(LostItemsService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);

  readonly lucidePackageX = PackageX;
  readonly lucideRefresh = RefreshCw;
  readonly lucideSearch = Search;
  readonly lucidePlus = Plus;
  readonly lucideCheck = Check;
  readonly lucideEye = Eye;
  readonly lucideEllipsisVertical = EllipsisVertical;

  private readonly viewportIsDesktop = injectMatchMinWidth(768);

  readonly nzTableScroll = computed(() =>
    this.viewportIsDesktop() ? {} : { x: '1200px' },
  );

  readonly sourceTabs = SOURCE_TABS;
  /** Role-scoped workflow tabs; role from {@link AuthService#userRole}. */
  readonly visibleStatusTabs = computed(() =>
    filterReturnsWorkflowListTabsBySource(
      visibleReturnsWorkflowListStatusTabs(this.auth.userRole()),
      this.activeSourceTab(),
    ),
  );
  readonly showWorkflowStatusTabBar = computed(() =>
    showReturnsWorkflowStatusTabBar(this.auth.userRole()),
  );
  readonly listWorkflowStatusParam = computed(() => {
    const role = this.auth.userRole();
    if (showReturnsWorkflowStatusTabBar(role)) {
      return returnsWorkflowListApiStatusParam(this.activeStatusTab());
    }
    return returnsWorkflowUnifiedListApiStatusParam(role);
  });
  readonly listCreatedById = computed(() => {
    const role = this.auth.userRole();
    if (showReturnsWorkflowStatusTabBar(role)) return undefined;
    if (!returnsWorkflowListShouldFilterCreatedBy(role)) return undefined;
    return this.auth.currentUser()?.id;
  });

  readonly pageSize = 20;

  readonly rows = signal<LostItemsListRow[]>([]);
  readonly total = signal(0);
  readonly loading = signal(false);
  readonly listError = signal('');
  readonly search = signal('');
  readonly page = signal(0);
  readonly activeSourceTab = signal<LostSourceType>('INTERNAL');
  readonly activeStatusTab = signal<ReturnsWorkflowListStatusTab>('DEPT_APPROVED');
  readonly createOpen = signal(false);
  readonly userRole = computed(() => this.auth.userRole());

  readonly returnsModalOpen = signal(false);
  readonly returnsModalRow = signal<LostItemsListRow | null>(null);
  readonly returnsModalDetail = signal<ReturnsWorkflowDocumentContext | null>(null);
  readonly returnsContextLoading = signal(false);
  readonly returnsSubmitting = signal(false);

  private readonly search$ = new Subject<string>();

  constructor() {
    effect(() => {
      this.auth.userRole();
      untracked(() => {
        if (!this.listViewReady) return;
        if (this.syncActiveStatusTabFromRole()) {
          this.load();
        }
      });
    });
  }

  ngOnInit(): void {
    this.syncActiveStatusTabFromRole();
    this.search$
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.page.set(0);
        this.load();
      });
    this.load();
    this.listViewReady = true;
    this.tryOpenCreateFromQuery();
  }

  private tryOpenCreateFromQuery(): void {
    if (this.createFromQueryHandled) return;
    if (this.route.snapshot.queryParamMap.get('create') !== '1') return;
    this.createFromQueryHandled = true;
    this.createOpen.set(true);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { create: null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  /** If the active tab is hidden for this role, switch to the first visible tab. */
  private syncActiveStatusTabFromRole(): boolean {
    const visible = this.visibleStatusTabs();
    const cur = this.activeStatusTab();
    if (visible.includes(cur)) return false;
    this.activeStatusTab.set(visible[0] ?? 'DEPT_APPROVED');
    this.page.set(0);
    return true;
  }

  onSearchInput(v: string): void {
    this.search.set(v);
    this.search$.next(v);
  }

  setSourceTab(tab: LostSourceType): void {
    this.activeSourceTab.set(tab);
    if (!this.visibleStatusTabs().includes(this.activeStatusTab())) {
      this.activeStatusTab.set(this.visibleStatusTabs()[0] ?? 'DEPT_APPROVED');
    }
    this.page.set(0);
    this.load();
  }

  setStatusTab(tab: ReturnsWorkflowListStatusTab): void {
    this.activeStatusTab.set(tab);
    this.page.set(0);
    this.load();
  }

  /** i18n key suffix under `LOST_ITEMS.STATUS.*` for workflow tabs (incl. virtual `IN_PROGRESS`). */
  workflowStatusTabLabelSuffix(tab: ReturnsWorkflowListStatusTab): string {
    return returnsWorkflowListTabTranslationSuffix(tab);
  }

  load(): void {
    this.loading.set(true);
    this.listError.set('');
    const status = this.listWorkflowStatusParam();
    const createdById = this.listCreatedById();
    this.api
      .list({
        skip: this.page() * this.pageSize,
        take: this.pageSize,
        search: this.search().trim() || undefined,
        sourceType: this.activeSourceTab(),
        status,
        createdById,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (r) => {
          this.rows.set(r.items);
          this.total.set(r.total);
          this.loading.set(false);
        },
        error: () => {
          this.listError.set(this.translate.instant('LOST_ITEMS.LIST.ERROR_LOAD'));
          this.loading.set(false);
        },
      });
  }

  setCreateOpen(open: boolean): void {
    this.createOpen.set(open);
  }

  onCreated(): void {
    this.createOpen.set(false);
    this.load();
  }

  displayUser(row: LostItemsListRow): string {
    const u = row.createdByUser;
    if (!u) return '—';
    return `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim() || '—';
  }

  sourceLabel(row: LostItemsListRow): string {
    return row.sourceType === 'GET_PASS_RETURN'
      ? this.translate.instant('LOST_ITEMS.LIST.SOURCE_FROM_RETURN')
      : this.translate.instant('LOST_ITEMS.LIST.SOURCE_INTERNAL');
  }

  /** From returns: accountability / remarks (notes preferred, else reason). */
  accountabilityLabel(row: LostItemsListRow): string {
    const n = row.notes?.trim();
    if (n) return n;
    const r = row.reason?.trim();
    if (r) return r;
    return '—';
  }

  /** Align lost workflow badges with breakage-style status classes. */
  statusBadgeClass(status: LostWorkflowStatus | string): string {
    switch (status) {
      case 'DRAFT':
        return 'pending';
      case 'DEPT_APPROVED':
      case 'COST_CONTROL_APPROVED':
      case 'FINANCE_APPROVED':
        return 'warning';
      case 'APPROVED':
        return 'active';
      default:
        return 'pending';
    }
  }

  private lostWorkflowContext(row: LostItemsListRow): ReturnsWorkflowDocumentContext {
    return {
      notes: row.notes ?? null,
      reason: row.reason ?? null,
      approvalRequests: row.approvalRequests as ReturnsWorkflowDocumentContext['approvalRequests'],
    };
  }

  /**
   * List row: show the three-dots menu when {@link userCanActOnReturnsWorkflowListRow} passes and the user has
   * `APPROVE_LOST` — applies to internal and get-pass-return documents.
   */
  canTakeLostWorkflowAction(row: LostItemsListRow): boolean {
    if (!this.auth.hasPermission(WORKFLOW_PERMISSION_APPROVE_LOST)) return false;
    return userCanActOnReturnsWorkflowListRow(this.userRole(), this.lostWorkflowContext(row), row.status);
  }

  lostListWaitingTagRole(row: LostItemsListRow): string | null {
    return returnsWorkflowListRowWaitingTagRole(
      this.userRole(),
      this.auth.currentUser()?.id,
      this.lostWorkflowContext(row),
      row,
    );
  }

  workflowRoleLabel(roleCode: string): string {
    const key = `USERS.ROLES.${roleCode}`;
    const t = this.translate.instant(key);
    return t !== key ? t : roleCode;
  }

  openReturnsApprove(row: LostItemsListRow): void {
    this.returnsModalRow.set(row);
    this.returnsModalOpen.set(true);
    this.returnsContextLoading.set(true);
    this.returnsModalDetail.set(null);
    this.api
      .getById(row.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (d) => {
          this.returnsModalDetail.set(d);
          this.returnsContextLoading.set(false);
        },
        error: () => {
          this.returnsModalDetail.set({
            notes: row.notes ?? null,
            reason: row.reason ?? null,
            approvalRequests: [],
          });
          this.returnsContextLoading.set(false);
        },
      });
  }

  closeReturnsModal(): void {
    this.returnsModalOpen.set(false);
    this.returnsModalRow.set(null);
    this.returnsModalDetail.set(null);
  }

  onReturnsSubmitted(accountability: ReturnsAccountabilityType): void {
    const row = this.returnsModalRow();
    if (!row) return;
    this.returnsSubmitting.set(true);
    const body = { accountability };
    const req$ = this.lostApproveRequest$(row, body);
    req$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.returnsSubmitting.set(false);
        this.message.success(this.translate.instant('LOST_ITEMS.LIST.APPROVE_SUCCESS'));
        this.returnsModalOpen.set(false);
        this.returnsModalRow.set(null);
        this.load();
      },
      error: (e: Error) => {
        this.returnsSubmitting.set(false);
        this.message.error(e.message || this.translate.instant('LOST_ITEMS.LIST.APPROVE_ERROR'));
      },
    });
  }

  private lostApproveRequest$(
    row: LostItemsListRow,
    body: { accountability: ReturnsAccountabilityType },
  ): Observable<LostItemsListRow | LostDetail> {
    return this.api.approveAtCurrentStep(
      row.id,
      {
        sourceType: row.sourceType,
        status: row.status,
        approvalRequests: row.approvalRequests,
      },
      body,
    );
  }

  goDetail(row: LostItemsListRow): void {
    this.router.navigate(['/lost-items', row.id]);
  }

  goGetPass(row: LostItemsListRow): void {
    const id = row.getPassId ?? row.getPass?.id;
    if (!id) return;
    this.router.navigate(['/get-passes', id]);
  }

  nextPage(): void {
    const maxPage = Math.max(0, Math.ceil(this.total() / this.pageSize) - 1);
    if (this.page() < maxPage) {
      this.page.update((p) => p + 1);
      this.load();
    }
  }

  prevPage(): void {
    if (this.page() > 0) {
      this.page.update((p) => p - 1);
      this.load();
    }
  }
}
