import { DatePipe, NgClass } from '@angular/common';
import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTooltipModule } from 'ng-zorro-antd/tooltip';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { LucideAngularModule } from 'lucide-angular';
import { AlertTriangle, Eye, Plus, RefreshCw, Search } from 'lucide-angular';
import { HasPermissionDirective } from '../../../core/directives/has-permission.directive';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import type { BreakageListRow, BreakageSourceType, BreakageWorkflowStatus } from '../models/breakage.model';
import { BreakageService } from '../services/breakage.service';
import { BreakageCreateModalComponent } from '../breakage-create-modal/breakage-create-modal.component';
import type { RequirementsResponse } from '../../items/models/item.model';
import { ItemsService } from '../../items/services/items.service';

const STATUS_TABS: BreakageWorkflowStatus[] = [
  'DRAFT',
  'DEPT_APPROVED',
  'COST_CONTROL_APPROVED',
  'FINANCE_APPROVED',
  'APPROVED',
];
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
    NzInputModule,
    NzSelectModule,
    NzTableModule,
    NzTooltipModule,
    TranslatePipe,
    LucideAngularModule,
    HasPermissionDirective,
    EmptyStateComponent,
    BreakageCreateModalComponent,
  ],
  templateUrl: './breakage-list.component.html',
  styleUrl: './breakage-list.component.scss',
})
export class BreakageListComponent implements OnInit {
  private readonly api = inject(BreakageService);
  private readonly itemsApi = inject(ItemsService);
  private readonly router = inject(Router);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);
  private static readonly DEFAULT_OB_STATUS: NonNullable<RequirementsResponse['obStatus']> = 'FINALIZED';

  readonly lucideAlert = AlertTriangle;
  readonly lucidePlus = Plus;
  readonly lucideRefresh = RefreshCw;
  readonly lucideEye = Eye;
  readonly lucideSearch = Search;

  readonly statusTabs = STATUS_TABS;
  readonly sourceTabs = SOURCE_TABS;
  readonly pageSize = 15;

  readonly activeStatusTab = signal<(typeof STATUS_TABS)[number]>('DRAFT');
  readonly activeSourceTab = signal<BreakageSourceType>('INTERNAL');
  readonly documents = signal<BreakageListRow[]>([]);
  readonly total = signal(0);
  readonly loading = signal(false);
  readonly listError = signal('');
  readonly createOpen = signal(false);
  readonly search = signal('');
  readonly page = signal(0);
  readonly requirements = signal<RequirementsResponse | null>(null);
  readonly obStatus = signal<NonNullable<RequirementsResponse['obStatus']>>(
    BreakageListComponent.DEFAULT_OB_STATUS,
  );
  readonly disableCreateButton = computed(
    () => this.obStatus() === 'INITIAL_LOCK' || this.obStatus() === 'OPEN',
  );

  private readonly search$ = new Subject<string>();

  ngOnInit(): void {
    this.search$
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.page.set(0);
        this.load();
      });
    this.loadRequirements();
    this.load();
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

  setStatusTab(tab: (typeof STATUS_TABS)[number]): void {
    this.activeStatusTab.set(tab);
    this.page.set(0);
    this.load();
  }

  setSourceTab(tab: BreakageSourceType): void {
    this.activeSourceTab.set(tab);
    this.page.set(0);
    this.load();
  }

  sourceTabLabel(tab: BreakageSourceType): string {
    return tab === 'INTERNAL'
      ? this.translate.instant('BREAKAGE.LIST.TAB_INTERNAL')
      : this.translate.instant('BREAKAGE.LIST.TAB_FROM_RETURNS');
  }

  onSearchInput(v: string): void {
    this.search.set(v);
    this.search$.next(v);
  }

  load(): void {
    this.loading.set(true);
    this.listError.set('');
    const status: BreakageWorkflowStatus = this.activeStatusTab();
    this.api
      .list({
        skip: this.page() * this.pageSize,
        take: this.pageSize,
        status,
        search: this.search().trim() || undefined,
        sourceType: this.activeSourceTab(),
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
    this.createOpen.set(true);
  }

  onCreateClosed(): void {
    this.createOpen.set(false);
  }

  onCreated(id: string): void {
    this.createOpen.set(false);
    this.router.navigate(['/breakage', id]);
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

  statusClass(status: BreakageWorkflowStatus | string): string {
    switch (status) {
      case 'DRAFT':
        return 'pending';
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
}
