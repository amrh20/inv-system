import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../../environments/environment';
import type { ApiResponse } from '../../../core/models/api-response.model';
import type { DashboardSummary, ChartData } from '../models/dashboard.model';

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
}
