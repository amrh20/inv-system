import { DatePipe, NgClass } from '@angular/common';
import {
  Component,
  DestroyRef,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzTableModule } from 'ng-zorro-antd/table';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { LucideAngularModule } from 'lucide-angular';
import { Check, PackageX, Plus, RefreshCw, Search } from 'lucide-angular';
import { AuthService } from '../../../core/services/auth.service';
import { HasPermissionDirective } from '../../../core/directives/has-permission.directive';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import type { LostItemsListRow, LostSourceType, LostWorkflowStatus } from '../models/lost-items.model';
import { LostItemsService } from '../services/lost-items.service';
import { LostCreateModalComponent } from '../lost-create-modal/lost-create-modal.component';

const SOURCE_TABS: LostSourceType[] = ['INTERNAL', 'GET_PASS_RETURN'];
const STATUS_TABS: LostWorkflowStatus[] = [
  'DRAFT',
  'DEPT_APPROVED',
  'COST_CONTROL_APPROVED',
  'FINANCE_APPROVED',
  'APPROVED',
];

@Component({
  selector: 'app-lost-items-list',
  standalone: true,
  imports: [
    DatePipe,
    NgClass,
    FormsModule,
    NzAlertModule,
    NzButtonModule,
    NzInputModule,
    NzTableModule,
    TranslatePipe,
    LucideAngularModule,
    HasPermissionDirective,
    EmptyStateComponent,
    LostCreateModalComponent,
  ],
  templateUrl: './lost-items-list.component.html',
  styleUrl: './lost-items-list.component.scss',
})
export class LostItemsListComponent implements OnInit {
  private readonly api = inject(LostItemsService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);

  readonly lucidePackageX = PackageX;
  readonly lucideRefresh = RefreshCw;
  readonly lucideSearch = Search;
  readonly lucidePlus = Plus;
  readonly lucideCheck = Check;
  readonly sourceTabs = SOURCE_TABS;
  readonly statusTabs = STATUS_TABS;

  readonly pageSize = 20;

  readonly rows = signal<LostItemsListRow[]>([]);
  readonly total = signal(0);
  readonly loading = signal(false);
  readonly listError = signal('');
  readonly search = signal('');
  readonly page = signal(0);
  readonly activeSourceTab = signal<LostSourceType>('INTERNAL');
  readonly activeStatusTab = signal<(typeof STATUS_TABS)[number]>('DRAFT');
  readonly createOpen = signal(false);
  readonly userRole = computed(() => this.auth.userRole());

  private readonly search$ = new Subject<string>();

  ngOnInit(): void {
    this.search$
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.page.set(0);
        this.load();
      });
    this.load();
  }

  onSearchInput(v: string): void {
    this.search.set(v);
    this.search$.next(v);
  }

  setSourceTab(tab: LostSourceType): void {
    this.activeSourceTab.set(tab);
    this.page.set(0);
    this.load();
  }

  setStatusTab(tab: (typeof STATUS_TABS)[number]): void {
    this.activeStatusTab.set(tab);
    this.page.set(0);
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.listError.set('');
    const status: LostWorkflowStatus = this.activeStatusTab();
    this.api
      .list({
        skip: this.page() * this.pageSize,
        take: this.pageSize,
        search: this.search().trim() || undefined,
        sourceType: this.activeSourceTab(),
        status,
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

  canApprove(row: LostItemsListRow): boolean {
    if (row.sourceType !== 'INTERNAL') return false;
    const role = this.userRole();
    if (!role) return false;
    if (role === 'ADMIN' || role === 'ORG_MANAGER') return row.status !== 'APPROVED';
    if (row.status === 'DRAFT' && role === 'DEPT_MANAGER') return true;
    if (row.status === 'DEPT_APPROVED' && role === 'COST_CONTROL') return true;
    if (row.status === 'COST_CONTROL_APPROVED' && role === 'FINANCE_MANAGER') return true;
    if (row.status === 'FINANCE_APPROVED' && role === 'GENERAL_MANAGER') return true;
    return false;
  }

  approve(row: LostItemsListRow): void {
    let action$ = this.api.approveDept(row.id);
    if (row.status === 'DEPT_APPROVED') action$ = this.api.approveCost(row.id);
    if (row.status === 'COST_CONTROL_APPROVED') action$ = this.api.approveFinance(row.id);
    if (row.status === 'FINANCE_APPROVED') action$ = this.api.approveGm(row.id);
    action$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.message.success(this.translate.instant('LOST_ITEMS.LIST.APPROVE_SUCCESS'));
        this.load();
      },
      error: (e: Error) => {
        this.message.error(e.message || this.translate.instant('LOST_ITEMS.LIST.APPROVE_ERROR'));
      },
    });
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
