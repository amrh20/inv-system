import { DatePipe, SlicePipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { LucideAngularModule } from 'lucide-angular';
import { Clock, RefreshCw, Shield, X } from 'lucide-angular';
import { first } from 'rxjs';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import type { AuditLogRow } from '../../models/admin.models';
import { AuditLogService } from '../../services/audit-log.service';
import { injectMatchMinWidth } from '../../../../shared/utils/viewport-media';

const ENTITY_TYPES = [
  'USER',
  'ITEM',
  'LOCATION',
  'CATEGORY',
  'BREAKAGE',
  'STOCK_COUNT',
  'GRN',
  'REQUISITION',
  'TRANSFER',
] as const;

@Component({
  selector: 'app-audit-log-page',
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
  templateUrl: './audit-log-page.component.html',
  styleUrl: './audit-log-page.component.scss',
})
export class AuditLogPageComponent implements OnInit {
  private readonly api = inject(AuditLogService);
  private readonly translate = inject(TranslateService);

  readonly lucideShield = Shield;
  readonly lucideRefresh = RefreshCw;
  readonly lucideX = X;
  readonly lucideClock = Clock;

  readonly entityTypes = ENTITY_TYPES;

  private readonly viewportIsDesktop = injectMatchMinWidth(768);

  readonly nzTableScroll = computed(() =>
    this.viewportIsDesktop() ? {} : { x: '1200px' },
  );

  readonly logs = signal<AuditLogRow[]>([]);
  readonly total = signal(0);
  readonly loading = signal(false);

  entityType = '';
  dateFrom = '';
  dateTo = '';
  readonly pageIndex = signal(1);
  readonly pageSize = signal(30);

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

  onFilterChange(): void {
    this.pageIndex.set(1);
    this.load();
  }

  clearFilters(): void {
    this.entityType = '';
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

  actionNzColor(action: string): string {
    switch (action) {
      case 'CREATE':
        return 'success';
      case 'UPDATE':
        return 'processing';
      case 'DELETE':
        return 'error';
      case 'APPROVE':
        return 'purple';
      case 'REJECT':
        return 'warning';
      default:
        return 'default';
    }
  }

  formatJson(val: unknown): { key: string; value: string }[] {
    if (val == null) return [];
    let obj: Record<string, unknown>;
    if (typeof val === 'string') {
      try {
        obj = JSON.parse(val) as Record<string, unknown>;
      } catch {
        return [{ key: '', value: val }];
      }
    } else if (typeof val === 'object' && !Array.isArray(val)) {
      obj = val as Record<string, unknown>;
    } else {
      return [{ key: '', value: String(val) }];
    }
    return Object.entries(obj).map(([k, v]) => ({ key: k, value: String(v) }));
  }

  displayTime(row: AuditLogRow): string | null {
    return row.createdAt ?? row.changedAt ?? null;
  }

  entityLabel(code: string): string {
    return this.translate.instant(`AUDIT_LOG.ENTITY_TYPES.${code}`);
  }
}
