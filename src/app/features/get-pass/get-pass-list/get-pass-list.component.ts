import { DatePipe, NgClass } from '@angular/common';
import {
  Component,
  DestroyRef,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { LucideAngularModule } from 'lucide-angular';
import { Eye, Package, Plus, RefreshCw } from 'lucide-angular';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import type { GetPassStatus, GetPassType } from '../../../core/models/enums';
import type { GetPassListRow } from '../models/get-pass.model';
import { GetPassService } from '../services/get-pass.service';

const STATUS_FILTERS: Array<'ALL' | GetPassStatus> = [
  'ALL',
  'DRAFT',
  'PENDING_DEPT',
  'PENDING_FINANCE',
  'PENDING_SECURITY',
  'APPROVED',
  'OUT',
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
    TranslatePipe,
    LucideAngularModule,
    EmptyStateComponent,
  ],
  templateUrl: './get-pass-list.component.html',
  styleUrl: './get-pass-list.component.scss',
})
export class GetPassListComponent implements OnInit {
  private readonly api = inject(GetPassService);
  private readonly router = inject(Router);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);

  readonly lucidePkg = Package;
  readonly lucidePlus = Plus;
  readonly lucideRefresh = RefreshCw;
  readonly lucideEye = Eye;

  readonly statusFilters = STATUS_FILTERS;
  readonly typeFilters = TYPE_FILTERS;

  readonly activeStatus = signal<(typeof STATUS_FILTERS)[number]>('ALL');
  readonly activeType = signal<(typeof TYPE_FILTERS)[number]>('ALL');
  readonly passes = signal<GetPassListRow[]>([]);
  readonly total = signal(0);
  readonly page = signal(1);
  readonly pageSize = 20;
  readonly loading = signal(false);
  readonly listError = signal('');

  ngOnInit(): void {
    this.load();
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

  statusLabel(s: string): string {
    if (s === 'ALL') return this.translate.instant('GET_PASS.LIST.FILTER_ALL_STATUS');
    return this.translate.instant(`GET_PASS.STATUS.${s}`);
  }

  typeLabel(t: string): string {
    if (t === 'ALL') return this.translate.instant('GET_PASS.LIST.FILTER_ALL_TYPES');
    return this.translate.instant(`GET_PASS.TYPE.${t}`);
  }

  load(): void {
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

  goNew(): void {
    this.router.navigate(['/get-passes/new']);
  }

  goDetail(p: GetPassListRow): void {
    this.router.navigate(['/get-passes', p.id]);
  }

  statusClass(status: GetPassStatus): string {
    switch (status) {
      case 'DRAFT':
      case 'PENDING_DEPT':
      case 'PENDING_FINANCE':
      case 'PENDING_SECURITY':
        return 'pending';
      case 'APPROVED':
      case 'OUT':
        return 'processing';
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
