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
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDropdownModule } from 'ng-zorro-antd/dropdown';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMenuModule } from 'ng-zorro-antd/menu';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTooltipModule } from 'ng-zorro-antd/tooltip';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { LucideAngularModule } from 'lucide-angular';
import { AlertTriangle, Check, EllipsisVertical, Eye, Plus, RefreshCw, Search } from 'lucide-angular';
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
  WORKFLOW_PERMISSION_APPROVE_BREAKAGE,
} from '../../../shared/utils/returns-workflow.helpers';
import type { BreakageListRow, BreakageSourceType, BreakageWorkflowStatus } from '../models/breakage.model';
import { BreakageService } from '../services/breakage.service';
import type { RequirementsResponse } from '../../items/models/item.model';
import { ItemsService } from '../../items/services/items.service';
import { injectMatchMinWidth } from '../../../shared/utils/viewport-media';

const SOURCE_TABS: BreakageSourceType[] = ['INTERNAL', 'GET_PASS_RETURN'];

@Component({
  selector: 'app-breakage-list',
  standalone: true,
  imports: [
    DatePipe,
    NgClass,
    FormsModule,
    NzAlertModule,
    NzButtonModule,
    NzDropdownModule,
    NzInputModule,
    NzModalModule,
    NzMenuModule,
    NzSelectModule,
    NzTableModule,
    NzTagModule,
    NzTooltipModule,
    TranslatePipe,
    LucideAngularModule,
    HasPermissionDirective,
    EmptyStateComponent,
    ReturnsWorkflowApproveModalComponent,
  ],
  templateUrl: './breakage-list.component.html',
  styleUrl: './breakage-list.component.scss',
})
export class BreakageListComponent implements OnInit {
  private listViewReady = false;

  private readonly api = inject(BreakageService);
  private readonly itemsApi = inject(ItemsService);
  private readonly router = inject(Router);
  private readonly translate = inject(TranslateService);
  private readonly message = inject(NzMessageService);
  private readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);
  private static readonly DEFAULT_OB_STATUS: NonNullable<RequirementsResponse['obStatus']> = 'FINALIZED';

  readonly lucideAlert = AlertTriangle;
  readonly lucidePlus = Plus;
  readonly lucideRefresh = RefreshCw;
  readonly lucideEye = Eye;
  readonly lucideSearch = Search;
  readonly lucideEllipsisVertical = EllipsisVertical;
  readonly lucideCheck = Check;

  private readonly viewportIsDesktop = injectMatchMinWidth(768);

  readonly nzTableScroll = computed(() =>
    this.viewportIsDesktop() ? {} : { x: '1200px' },
  );

  /** Role-scoped workflow tabs (breakage & lost lists share rules). Role from {@link AuthService#userRole}. */
  readonly visibleStatusTabs = computed(() =>
    filterReturnsWorkflowListTabsBySource(
      visibleReturnsWorkflowListStatusTabs(this.auth.userRole()),
      this.activeSourceTab(),
    ),
  );
  /** Workflow stage filter tabs — only org admins; functional roles use {@link listWorkflowStatusParam}. */
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
  readonly sourceTabs = SOURCE_TABS;
  readonly pageSize = 15;

  readonly activeStatusTab = signal<ReturnsWorkflowListStatusTab>('DEPT_APPROVED');
  readonly activeSourceTab = signal<BreakageSourceType>('INTERNAL');
  readonly documents = signal<BreakageListRow[]>([]);
  readonly total = signal(0);
  readonly loading = signal(false);
  readonly listError = signal('');
  readonly search = signal('');
  readonly page = signal(0);
  readonly requirements = signal<RequirementsResponse | null>(null);
  readonly obStatus = signal<NonNullable<RequirementsResponse['obStatus']>>(
    BreakageListComponent.DEFAULT_OB_STATUS,
  );
  readonly disableCreateButton = computed(
    () => this.obStatus() === 'INITIAL_LOCK' || this.obStatus() === 'OPEN',
  );

  readonly returnsModalOpen = signal(false);
  readonly returnsModalDoc = signal<BreakageListRow | null>(null);
  readonly returnsModalDetail = signal<ReturnsWorkflowDocumentContext | null>(null);
  readonly returnsContextLoading = signal(false);
  readonly returnsSubmitting = signal(false);
  readonly imagePreviewOpen = signal(false);
  readonly imagePreviewUrl = signal<string | null>(null);

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
    this.loadRequirements();
    this.load();
    this.listViewReady = true;
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

  private loadRequirements(): void {
    this.itemsApi
      .checkRequirements()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          if (!res.success || !res.data) {
            this.requirements.set(null);
            this.obStatus.set(BreakageListComponent.DEFAULT_OB_STATUS);
            return;
          }
          const normalizedObStatus =
            res.data.obStatus ??
            (res.data.isOpeningBalanceAllowed ? 'OPEN' : BreakageListComponent.DEFAULT_OB_STATUS);
          this.requirements.set(res.data);
          this.obStatus.set(normalizedObStatus);
        },
        error: () => {
          this.requirements.set(null);
          this.obStatus.set(BreakageListComponent.DEFAULT_OB_STATUS);
        },
      });
  }

  setStatusTab(tab: ReturnsWorkflowListStatusTab): void {
    this.activeStatusTab.set(tab);
    this.page.set(0);
    this.load();
  }

  setSourceTab(tab: BreakageSourceType): void {
    this.activeSourceTab.set(tab);
    if (!this.visibleStatusTabs().includes(this.activeStatusTab())) {
      this.activeStatusTab.set(this.visibleStatusTabs()[0] ?? 'DEPT_APPROVED');
    }
    this.page.set(0);
    this.load();
  }

  sourceTabLabel(tab: BreakageSourceType): string {
    return tab === 'INTERNAL'
      ? this.translate.instant('BREAKAGE.LIST.TAB_INTERNAL')
      : this.translate.instant('BREAKAGE.LIST.TAB_FROM_RETURNS');
  }

  /** i18n key suffix under `BREAKAGE.STATUS.*` for workflow tabs (incl. virtual `IN_PROGRESS`). */
  workflowStatusTabLabelSuffix(tab: ReturnsWorkflowListStatusTab): string {
    return returnsWorkflowListTabTranslationSuffix(tab);
  }

  onSearchInput(v: string): void {
    this.search.set(v);
    this.search$.next(v);
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
        status,
        search: this.search().trim() || undefined,
        sourceType: this.activeSourceTab(),
        createdById,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (r) => {
          this.documents.set(r.documents);
          this.total.set(r.total);
          this.loading.set(false);
        },
        error: () => {
          this.listError.set(this.translate.instant('BREAKAGE.LIST.ERROR_LOAD'));
          this.loading.set(false);
        },
      });
  }

  openCreate(): void {
    if (this.disableCreateButton()) {
      return;
    }
    this.router.navigate(['/breakage/new']);
  }

  goDetail(doc: BreakageListRow): void {
    this.router.navigate(['/breakage', doc.id]);
  }

  goGetPass(doc: BreakageListRow): void {
    const id = doc.getPassId ?? doc.getPass?.id;
    if (!id) return;
    this.router.navigate(['/get-passes', id]);
  }

  sourceLabel(doc: BreakageListRow): string {
    if (doc.sourceType === 'GET_PASS_RETURN') {
      return this.translate.instant('BREAKAGE.LIST.SOURCE_FROM_RETURN');
    }
    return this.translate.instant('BREAKAGE.LIST.SOURCE_INTERNAL');
  }

  /** Returns tab: total damaged qty when API sends `totalQtyDamaged`; otherwise em dash. */
  returnsQtyLabel(doc: BreakageListRow): string {
    const n = doc.totalQtyDamaged;
    if (n !== undefined && n !== null && !Number.isNaN(Number(n))) {
      return String(n);
    }
    return '—';
  }

  /** Returns tab: accountability from notes, else reason. */
  accountabilityLabel(doc: BreakageListRow): string {
    const fromNotes = doc.notes?.trim();
    if (fromNotes) return fromNotes;
    const fromReason = doc.reason?.trim();
    if (fromReason) return fromReason;
    return '—';
  }

  private returnsWorkflowContext(doc: BreakageListRow): ReturnsWorkflowDocumentContext {
    return {
      notes: doc.notes ?? null,
      reason: doc.reason ?? null,
      approvalRequests: doc.approvalRequests as ReturnsWorkflowDocumentContext['approvalRequests'],
    };
  }

  /**
   * List row: show the three-dots menu (View + Take action) when {@link userCanActOnReturnsWorkflowListRow}
   * passes and the user has `APPROVE_BREAKAGE` — applies to internal and get-pass-return documents.
   */
  canTakeBreakageWorkflowAction(doc: BreakageListRow): boolean {
    if (!this.auth.hasPermission(WORKFLOW_PERMISSION_APPROVE_BREAKAGE)) return false;
    return userCanActOnReturnsWorkflowListRow(
      this.auth.userRole(),
      this.returnsWorkflowContext(doc),
      String(doc.status),
    );
  }

  /** “Waiting for …” tag: approver already acted, or dept manager viewing own in-flight doc. */
  returnsBreakageWaitingTagRole(doc: BreakageListRow): string | null {
    return returnsWorkflowListRowWaitingTagRole(
      this.auth.userRole(),
      this.auth.currentUser()?.id,
      this.returnsWorkflowContext(doc),
      doc,
    );
  }

  workflowRoleLabel(roleCode: string): string {
    const key = `USERS.ROLES.${roleCode}`;
    const t = this.translate.instant(key);
    return t !== key ? t : roleCode;
  }

  openReturnsBreakageApprove(doc: BreakageListRow): void {
    this.returnsModalDoc.set(doc);
    this.returnsModalOpen.set(true);
    this.returnsContextLoading.set(true);
    this.returnsModalDetail.set(null);
    this.api
      .getById(doc.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (d) => {
          this.returnsModalDetail.set(d);
          this.returnsContextLoading.set(false);
        },
        error: () => {
          this.returnsModalDetail.set({
            notes: doc.notes ?? null,
            reason: doc.reason ?? null,
            approvalRequests: [],
          });
          this.returnsContextLoading.set(false);
        },
      });
  }

  closeReturnsBreakageModal(): void {
    this.returnsModalOpen.set(false);
    this.returnsModalDoc.set(null);
    this.returnsModalDetail.set(null);
  }

  onReturnsBreakageSubmitted(accountability: ReturnsAccountabilityType): void {
    const doc = this.returnsModalDoc();
    if (!doc) return;
    this.returnsSubmitting.set(true);
    this.api
      .approveAtCurrentStep(
        doc.id,
        {
          sourceType: doc.sourceType,
          status: String(doc.status),
          approvalRequests: doc.approvalRequests,
        },
        { accountability },
      )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.returnsSubmitting.set(false);
          this.returnsModalOpen.set(false);
          this.returnsModalDoc.set(null);
          this.message.success(this.translate.instant('BREAKAGE.DETAIL.ACTION_OK'));
          this.load();
        },
        error: (e: Error) => {
          this.returnsSubmitting.set(false);
          this.message.error(e.message || this.translate.instant('BREAKAGE.DETAIL.ACTION_FAIL'));
        },
      });
  }

  statusClass(status: BreakageWorkflowStatus | string): string {
    switch (status) {
    
      case 'DEPT_APPROVED':
      case 'COST_CONTROL_APPROVED':
      case 'FINANCE_APPROVED':
        return 'warning';
      case 'APPROVED':
        return 'active';
      case 'REJECTED':
        return 'rejected';
      case 'VOID':
        return 'inactive';
      default:
        return 'pending';
    }
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

  openImageModal(url?: string | null): void {
    if (!url) return;
    this.imagePreviewUrl.set(url);
    this.imagePreviewOpen.set(true);
  }

  closeImageModal(): void {
    this.imagePreviewOpen.set(false);
    this.imagePreviewUrl.set(null);
  }
}
