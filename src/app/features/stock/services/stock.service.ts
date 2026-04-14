import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../../environments/environment';
import type { ApiResponse } from '../../../core/models/api-response.model';
import type {
  StockBalancesListResult,
  StockBalancesParams,
  StockBalancesSummary,
  StockBalanceRow,
} from '../models/stock-balance.model';

@Injectable({ providedIn: 'root' })
export class StockService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/stock-balances`;

  getStockBalances(params: StockBalancesParams): Observable<StockBalancesListResult> {
    let httpParams = new HttpParams();
    const entries: [string, string | number | undefined][] = [
      ['take', params.take],
      ['skip', params.skip],
      ['search', params.search],
      ['locationId', params.locationId],
      ['categoryId', params.categoryId],
      ['departmentId', params.departmentId],
      ['showZero', params.showZero],
    ];
    for (const [key, value] of entries) {
      if (value !== undefined && value !== null && value !== '') {
        httpParams = httpParams.set(key, String(value));
      }
    }
    return this.http.get<ApiResponse<StockBalanceRow[]>>(this.base, { params: httpParams }).pipe(
      map((res) => ({
        balances: res.success && Array.isArray(res.data) ? res.data : [],
        total: res.meta?.total ?? 0,
      })),
    );
  }

  getSummary(params: StockBalancesParams): Observable<StockBalancesSummary | null> {
    let httpParams = new HttpParams();
    const entries: [string, string | number | undefined][] = [
      ['search', params.search],
      ['locationId', params.locationId],
      ['categoryId', params.categoryId],
      ['departmentId', params.departmentId],
      ['showZero', params.showZero],
    ];
    for (const [key, value] of entries) {
      if (value !== undefined && value !== null && value !== '') {
        httpParams = httpParams.set(key, String(value));
      }
    }
    return this.http.get<ApiResponse<StockBalancesSummary>>(`${this.base}/summary`, { params: httpParams }).pipe(
      map((res) => (res.success && res.data ? res.data : null)),
    );
  }

  exportStockBalances(params: StockBalancesParams): Observable<Blob> {
    let httpParams = new HttpParams();
    const entries: [string, string | number | undefined][] = [
      ['search', params.search],
      ['locationId', params.locationId],
      ['categoryId', params.categoryId],
      ['departmentId', params.departmentId],
      ['showZero', params.showZero],
    ];
    for (const [key, value] of entries) {
      if (value !== undefined && value !== null && value !== '') {
        httpParams = httpParams.set(key, String(value));
      }
    }
    return this.http.get(`${this.base}/export`, {
      params: httpParams,
      responseType: 'blob',
    });
  }
}
