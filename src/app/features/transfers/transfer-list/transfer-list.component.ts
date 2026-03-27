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
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzTableModule } from 'ng-zorro-antd/table';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { LucideAngularModule } from 'lucide-angular';
import { ArrowRightLeft, ChevronRight, Plus, RefreshCw } from 'lucide-angular';
import { HasPermissionDirective } from '../../../core/directives/has-permission.directive';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import type { TransferListRow } from '../models/transfer.model';
import type { TransferStatus } from '../../../core/models/enums';
import { TransferService } from '../services/transfer.service';

const TABS: Array<'ALL' | TransferStatus> = [
  'ALL',
  'DRAFT',
  'SUBMITTED',
  'APPROVED',
  'IN_TRANSIT',
  'RECEIVED',
  'CLOSED',
  'REJECTED',
];

@Component({
  selector: 'app-transfer-list',
  standalone: true,
  imports: [
    DatePipe,
    NgClass,
    NzAlertModule,
    NzButtonModule,
    NzTableModule,
    TranslatePipe,
    LucideAngularModule,
    HasPermissionDirective,
    EmptyStateComponent,
  ],
  templateUrl: './transfer-list.component.html',
  styleUrl: './transfer-list.component.scss',
})
export class TransferListComponent implements OnInit {
  private readonly api = inject(TransferService);
  private readonly router = inject(Router);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);

  readonly lucideArrows = ArrowRightLeft;
  readonly lucidePlus = Plus;
  readonly lucideRefresh = RefreshCw;
  readonly lucideChevron = ChevronRight;

  readonly tabs = TABS;

  readonly activeTab = signal<(typeof TABS)[number]>('ALL');
  readonly transfers = signal<TransferListRow[]>([]);
  readonly total = signal(0);
  readonly loading = signal(false);
  readonly listError = signal('');

  ngOnInit(): void {
    this.load();
  }

  setTab(tab: (typeof TABS)[number]): void {
    this.activeTab.set(tab);
    this.load();
  }

  tabLabel(tab: string): string {
    if (tab === 'ALL') return this.translate.instant('TRANSFER.LIST.TAB_ALL');
    return this.translate.instant(`TRANSFER.STATUS.${tab}`);
  }

  load(): void {
    this.loading.set(true);
    this.listError.set('');
    const status = this.activeTab() === 'ALL' ? undefined : this.activeTab();
    this.api
      .list(status ? { status } : {})
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (r) => {
          this.transfers.set(r.transfers);
          this.total.set(r.total);
          this.loading.set(false);
        },
        error: () => {
          this.listError.set(this.translate.instant('TRANSFER.LIST.ERROR_LOAD'));
          this.loading.set(false);
        },
      });
  }

  goNew(): void {
    this.router.navigate(['/transfers/new']);
  }

  goDetail(t: TransferListRow): void {
    this.router.navigate(['/transfers', t.id]);
  }

  statusClass(status: TransferStatus): string {
    switch (status) {
      case 'DRAFT':
        return 'pending';
      case 'SUBMITTED':
        return 'pending';
      case 'APPROVED':
        return 'processing';
      case 'IN_TRANSIT':
        return 'low-stock';
      case 'RECEIVED':
      case 'CLOSED':
        return 'success';
      case 'REJECTED':
        return 'rejected';
      default:
        return 'pending';
    }
  }
}
