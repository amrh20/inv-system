import { DatePipe, SlicePipe } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { LucideAngularModule } from 'lucide-angular';
import { History, RefreshCw, Search } from 'lucide-angular';
import { first } from 'rxjs';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import type { AuditLogRow } from '../../models/admin.models';
import { AuditLogService } from '../../services/audit-log.service';

const IH_ENTITY_CODES = [
  'MOVEMENT',
  'STOCK_COUNT',
  'PERIOD_CLOSE',
  'GRN',
  'BREAKAGE',
  'TRANSFER',
  'ITEM',
  'LOCATION',
  'DEPARTMENT',
  'SETTINGS',
  'USER',
] as const;

const IH_ACTIONS = [
  'CREATE',
  'SUBMIT',
  'POST',
  'APPROVE',
  'COUNT_APPROVE',
  'REJECT',
  'COUNT_REJECT',
  'VOID',
  'UPDATE',
  'DELETE',
  'IMPORT',
  'CLOSE_PERIOD',
  'REOPEN_PERIOD',
  'LOCK_OB',
  'LOGIN',
  'LOGOUT',
] as const;

@Component({
  selector: 'app-inventory-history-page',
  standalone: true,
  imports: [
    DatePipe,
    SlicePipe,
    FormsModule,
    NzButtonModule,
    NzTableModule,
    NzTagModule,
    TranslatePipe,
    LucideAngularModule,
    EmptyStateComponent,
  ],
  templateUrl: './inventory-history-page.component.html',
  styleUrl: './inventory-history-page.component.scss',
})
export class InventoryHistoryPageComponent implements OnInit {
  private readonly api = inject(AuditLogService);
  private readonly translate = inject(TranslateService);

  readonly lucideHistory = History;
  readonly lucideSearch = Search;
  readonly lucideRefresh = RefreshCw;

  readonly entityCodes = IH_ENTITY_CODES;
  readonly actionCodes = IH_ACTIONS;

  readonly logs = signal<AuditLogRow[]>([]);
  readonly total = signal(0);
  readonly loading = signal(false);

  entityType = '';
  action = '';
  dateFrom = '';
  dateTo = '';
  readonly pageIndex = signal(1);
  readonly pageSize = signal(50);

  ngOnInit(): void {
    this.load();
  }

  t(key: string): string {
    return this.translate.instant(key);
  }

  load(): void {
    this.loading.set(true);
    this.api
      .list({
        page: this.pageIndex(),
        limit: this.pageSize(),
        entityType: this.entityType || undefined,
        from: this.dateFrom || undefined,
        to: this.dateTo || undefined,
        action: this.action || undefined,
      })
      .pipe(first())
      .subscribe({
        next: (res) => {
          this.logs.set(res.logs);
          this.total.set(res.total);
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
          this.logs.set([]);
        },
      });
  }

  search(): void {
    this.pageIndex.set(1);
    this.load();
  }

  clearFilters(): void {
    this.entityType = '';
    this.action = '';
    this.dateFrom = '';
    this.dateTo = '';
    this.pageIndex.set(1);
    this.load();
  }

  onPageIndexChange(p: number): void {
    this.pageIndex.set(p);
    this.load();
  }

  onPageSizeChange(s: number): void {
    this.pageSize.set(s);
    this.pageIndex.set(1);
    this.load();
  }

  entityLabel(code: string): string {
    return this.translate.instant(`INVENTORY_HISTORY.ENTITIES.${code}`);
  }

  actionLabel(code: string): string {
    return this.translate.instant(`INVENTORY_HISTORY.ACTIONS.${code}`);
  }

  actionNzColor(action: string): string {
    if (action.startsWith('REJECT') || action === 'DELETE') return 'error';
    if (action.includes('APPROVE') || action === 'POST') return 'success';
    if (action === 'VOID') return 'warning';
    if (action === 'UPDATE') return 'gold';
    if (action === 'CREATE' || action === 'IMPORT') return 'processing';
    return 'default';
  }

  displayTime(row: AuditLogRow): string | null {
    return row.changedAt ?? row.createdAt ?? null;
  }

  displayEntity(row: AuditLogRow): string {
    const key = `INVENTORY_HISTORY.ENTITIES.${row.entityType}`;
    const tr = this.translate.instant(key);
    return tr !== key ? tr : row.entityType;
  }

  userName(row: AuditLogRow): string {
    const u = row.changedByUser;
    if (!u) return '—';
    const name = `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim();
    return name || u.email || '—';
  }

  formatActionLabel(action: string | undefined): string {
    return (action ?? '').replace(/_/g, ' ');
  }
}
