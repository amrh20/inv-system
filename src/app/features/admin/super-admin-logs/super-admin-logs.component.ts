import { DatePipe, UpperCasePipe } from '@angular/common';
import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { TranslatePipe } from '@ngx-translate/core';
import { LucideAngularModule } from 'lucide-angular';
import {
  Building2,
  ChevronLeft,
  ChevronRight,
  Filter,
  RefreshCw,
  ScrollText,
} from 'lucide-angular';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import type { SuperAdminLogRow } from '../models/super-admin-log.model';
import { SuperAdminLogsService } from '../services/super-admin-logs.service';

const ACTION_CONFIG: Record<string, string> = {
  TENANT_CREATED: 'Created',
  TENANT_UPDATED: 'Updated',
  TENANT_ACTIVATED: 'Activated',
  TENANT_SUSPENDED: 'Suspended',
  PLAN_CHANGED: 'Plan Changed',
  FORCE_LOGOUT: 'Force Logout',
  IMPERSONATION_STARTED: 'Impersonation',
};

@Component({
  selector: 'app-super-admin-logs',
  standalone: true,
  imports: [
    DatePipe,
    UpperCasePipe,
    FormsModule,
    NzButtonModule,
    NzTableModule,
    NzTagModule,
    TranslatePipe,
    LucideAngularModule,
    EmptyStateComponent,
  ],
  templateUrl: './super-admin-logs.component.html',
  styleUrl: './super-admin-logs.component.scss',
})
export class SuperAdminLogsComponent implements OnInit {
  private readonly api = inject(SuperAdminLogsService);
  private readonly destroyRef = inject(DestroyRef);

  readonly lucideScrollText = ScrollText;
  readonly lucideRefreshCw = RefreshCw;
  readonly lucideFilter = Filter;
  readonly lucideBuilding2 = Building2;
  readonly lucideChevronLeft = ChevronLeft;
  readonly lucideChevronRight = ChevronRight;

  readonly logs = signal<SuperAdminLogRow[]>([]);
  readonly total = signal(0);
  readonly loading = signal(false);

  actionFilter = '';
  readonly pageIndex = signal(1);
  readonly pageSize = signal(25);
  readonly actionOptions = Object.entries(ACTION_CONFIG);

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.api
      .list({
        page: this.pageIndex(),
        limit: this.pageSize(),
        action: this.actionFilter || undefined,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.logs.set(res.data);
          this.total.set(res.total);
          this.loading.set(false);
        },
        error: () => {
          this.logs.set([]);
          this.loading.set(false);
        },
      });
  }

  onFilterChange(): void {
    this.pageIndex.set(1);
    this.load();
  }

  onPageChange(p: number): void {
    this.pageIndex.set(p);
    this.load();
  }

  actionLabel(action: string): string {
    return ACTION_CONFIG[action] ?? action;
  }

  actionNzColor(action: string): string {
    switch (action) {
      case 'TENANT_CREATED':
      case 'TENANT_ACTIVATED':
        return 'success';
      case 'TENANT_UPDATED':
      case 'PLAN_CHANGED':
        return 'processing';
      case 'TENANT_SUSPENDED':
      case 'FORCE_LOGOUT':
        return 'error';
      case 'IMPERSONATION_STARTED':
        return 'warning';
      default:
        return 'default';
    }
  }

  formatTime(dateStr: string): string {
    return new Date(dateStr).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  adminDisplay(log: SuperAdminLogRow): string {
    const u = log.adminUser;
    if (!u) return '—';
    const name = `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim();
    return name || (u.email ?? '—');
  }

  targetDisplay(log: SuperAdminLogRow): string {
    const t = log.targetTenant;
    if (t?.name) return t.name;
    if (log.targetTenantId) return log.targetTenantId.slice(0, 8) + '…';
    return '—';
  }

  detailsPreview(log: SuperAdminLogRow): string {
    if (!log.details) return '—';
    const str = JSON.stringify(log.details);
    return str.length > 60 ? str.substring(0, 60) + '…' : str;
  }

  totalPages(): number {
    return Math.ceil(this.total() / this.pageSize()) || 1;
  }
}
