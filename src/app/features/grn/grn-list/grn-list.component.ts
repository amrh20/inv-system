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
import { FileText, Plus, RefreshCw } from 'lucide-angular';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import type { GrnListRow } from '../models/grn.model';
import { GrnService } from '../services/grn.service';
import { GrnCreateModalComponent } from '../grn-create-modal/grn-create-modal.component';

const TABS: Array<'All' | GrnListRow['status']> = [
  'All',
  'DRAFT',
  'VALIDATED',
  'PENDING_APPROVAL',
  'APPROVED',
  'POSTED',
  'REJECTED',
];

@Component({
  selector: 'app-grn-list',
  standalone: true,
  imports: [
    DatePipe,
    NgClass,
    NzAlertModule,
    NzButtonModule,
    NzTableModule,
    TranslatePipe,
    LucideAngularModule,
    EmptyStateComponent,
    GrnCreateModalComponent,
  ],
  templateUrl: './grn-list.component.html',
  styleUrl: './grn-list.component.scss',
})
export class GrnListComponent implements OnInit {
  private readonly grnApi = inject(GrnService);
  private readonly router = inject(Router);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);

  readonly lucideFileText = FileText;
  readonly lucidePlus = Plus;
  readonly lucideRefresh = RefreshCw;

  readonly tabs = TABS;

  readonly activeTab = signal<(typeof TABS)[number]>('All');
  readonly grns = signal<GrnListRow[]>([]);
  readonly total = signal(0);
  readonly loading = signal(false);
  readonly listError = signal('');
  readonly createOpen = signal(false);

  ngOnInit(): void {
    this.load();
  }

  setTab(tab: (typeof TABS)[number]): void {
    this.activeTab.set(tab);
    this.load();
  }

  tabLabel(tab: string): string {
    if (tab === 'All') return this.translate.instant('GRN.LIST.TAB_ALL');
    return this.translate.instant(`GRN.STATUS.${tab}`);
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
        },
        error: () => {
          this.listError.set(this.translate.instant('GRN.LIST.ERROR_LOAD'));
          this.loading.set(false);
        },
      });
  }

  openCreate(): void {
    this.createOpen.set(true);
  }

  onCreateClosed(): void {
    this.createOpen.set(false);
  }

  onCreated(): void {
    this.createOpen.set(false);
    this.load();
  }

  goToDetail(grn: GrnListRow): void {
    this.router.navigate(['/grn', grn.id]);
  }

  statusClass(status: GrnListRow['status']): string {
    switch (status) {
      case 'DRAFT':
        return 'draft';
      case 'VALIDATED':
        return 'processing';
      case 'PENDING_APPROVAL':
        return 'pending';
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
