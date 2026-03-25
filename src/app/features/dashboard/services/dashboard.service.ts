import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../../environments/environment';
import type { ApiResponse } from '../../../core/models/api-response.model';
import type {
  BranchSummary,
  ChartData,
  DashboardSummary,
  OrganizationDashboardSummary,
} from '../models/dashboard.model';

export interface DashboardSummaryResult {
  data: DashboardSummary;
  responseTimeMs: number | null;
}

@Injectable({ providedIn: 'root' })
export class DashboardService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/dashboard`;

  getSummary(): Observable<DashboardSummaryResult> {
    return this.http
      .get<ApiResponse<DashboardSummary> & { meta?: { responseTimeMs?: number } }>(`${this.base}/summary`)
      .pipe(
        map((res) => ({
          data: res.data!,
          responseTimeMs: res.meta?.responseTimeMs ?? null,
        })),
      );
  }

  getCharts(): Observable<ChartData | null> {
    return this.http
      .get<ApiResponse<ChartData>>(`${this.base}/charts`)
      .pipe(map((res) => (res.success && res.data ? res.data : null)));
  }

  /**
   * Organization comparison — `data` may be a branch row array or a full object with `branches`.
   * GET /api/dashboard/organization-summary?parentTenantId=...
   */
  getOrganizationSummary(parentTenantId: string): Observable<OrganizationDashboardSummary | null> {
    const params = new HttpParams().set('parentTenantId', parentTenantId);
    return this.http
      .get<ApiResponse<unknown>>(`${this.base}/organization-summary`, { params })
      .pipe(map((res) => (res.success ? normalizeOrganizationPayload(res.data) : null)));
  }
}

function normalizeOrganizationPayload(raw: unknown): OrganizationDashboardSummary | null {
  if (raw === undefined || raw === null) {
    return null;
  }

  if (Array.isArray(raw)) {
    return {
      branches: raw.map((row, i) => mapBranchRow(row, i)),
    };
  }

  if (typeof raw === 'object') {
    const o = raw as Record<string, unknown>;
    const nested = o['branches'];
    if (Array.isArray(nested)) {
      return {
        parentTenantId: typeof o['parentTenantId'] === 'string' ? o['parentTenantId'] : undefined,
        totals: o['totals'] as OrganizationDashboardSummary['totals'],
        branches: nested.map((row, i) => mapBranchRow(row, i)),
        generatedAt: typeof o['generatedAt'] === 'string' ? o['generatedAt'] : undefined,
      };
    }
  }

  return null;
}

function mapBranchRow(raw: unknown, index: number): BranchSummary {
  const r = raw as Record<string, unknown>;
  const branchName = String(
    r['branchName'] ?? r['tenantName'] ?? r['tenant_name'] ?? `branch-${index}`,
  );
  const tenantSlug = String(r['tenantSlug'] ?? r['tenant_slug'] ?? branchName);

  return {
    branchName,
    tenantSlug,
    inventoryValue: num(r['inventoryValue'] ?? r['inventory_value']),
    consumptionValue: num(
      r['consumption'] ?? r['consumptionValue'] ?? r['consumption_value'],
    ),
    wasteValue: num(r['waste'] ?? r['wasteValue'] ?? r['waste_value']),
    pendingTasks: num(r['pendingTasks'] ?? r['pending_tasks']),
  };
}

function num(v: unknown): number {
  if (typeof v === 'number' && !Number.isNaN(v)) {
    return v;
  }
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v);
    return Number.isNaN(n) ? 0 : n;
  }
  return 0;
}
