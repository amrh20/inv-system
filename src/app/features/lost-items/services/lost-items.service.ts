import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../../environments/environment';
import type { ApiResponse } from '../../../core/models/api-response.model';
import type {
  LostCreatePayload,
  LostItemsListRow,
  LostSourceType,
  LostWorkflowStatus,
} from '../models/lost-items.model';

@Injectable({ providedIn: 'root' })
export class LostItemsService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/lost`;

  list(params?: {
    skip?: number;
    take?: number;
    search?: string;
    status?: LostWorkflowStatus;
    sourceType?: LostSourceType;
  }): Observable<{ items: LostItemsListRow[]; total: number }> {
    let p = new HttpParams()
      .set('take', String(params?.take ?? 20))
      .set('skip', String(params?.skip ?? 0));
    if (params?.search) p = p.set('search', params.search);
    if (params?.status) p = p.set('status', params.status);
    if (params?.sourceType) p = p.set('sourceType', params.sourceType);
    return this.http.get<ApiResponse<LostItemsListRow[]>>(this.base, { params: p }).pipe(
      map((res) => ({
        items: res.success && Array.isArray(res.data) ? res.data : [],
        total: res.meta?.total ?? 0,
      })),
    );
  }

  create(body: LostCreatePayload): Observable<LostItemsListRow> {
    return this.http.post<ApiResponse<LostItemsListRow>>(this.base, body).pipe(
      map((res) => {
        if (!res.success || !res.data) throw new Error(res.message || 'Create failed');
        return res.data;
      }),
    );
  }

  approveDept(id: string): Observable<LostItemsListRow> {
    return this.http.post<ApiResponse<LostItemsListRow>>(`${this.base}/${id}/approve-dept`, {}).pipe(
      map((res) => {
        if (!res.success || !res.data) throw new Error(res.message || 'Department approval failed');
        return res.data;
      }),
    );
  }

  approveCost(id: string): Observable<LostItemsListRow> {
    return this.http.post<ApiResponse<LostItemsListRow>>(`${this.base}/${id}/approve-cost`, {}).pipe(
      map((res) => {
        if (!res.success || !res.data) throw new Error(res.message || 'Cost approval failed');
        return res.data;
      }),
    );
  }

  approveFinance(id: string): Observable<LostItemsListRow> {
    return this.http.post<ApiResponse<LostItemsListRow>>(`${this.base}/${id}/approve-finance`, {}).pipe(
      map((res) => {
        if (!res.success || !res.data) throw new Error(res.message || 'Finance approval failed');
        return res.data;
      }),
    );
  }

  approveGm(id: string): Observable<LostItemsListRow> {
    return this.http.post<ApiResponse<LostItemsListRow>>(`${this.base}/${id}/approve-gm`, {}).pipe(
      map((res) => {
        if (!res.success || !res.data) throw new Error(res.message || 'GM approval failed');
        return res.data;
      }),
    );
  }
}
