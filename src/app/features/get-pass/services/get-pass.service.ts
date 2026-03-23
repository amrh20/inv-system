import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../../environments/environment';
import type { ApiResponse } from '../../../core/models/api-response.model';
import type {
  GetPassCreatePayload,
  GetPassDetail,
  GetPassListRow,
  GetPassReturnLinePayload,
  GetPassUpdatePayload,
} from '../models/get-pass.model';

/** Backend spreads list result: `{ success, data, total, page, limit }` */
interface GetPassListHttpBody {
  success: boolean;
  data: GetPassListRow[];
  total: number;
  page: number;
  limit: number;
}

@Injectable({ providedIn: 'root' })
export class GetPassService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/get-passes`;

  list(params?: {
    page?: number;
    limit?: number;
    status?: string;
    transferType?: string;
  }): Observable<{ passes: GetPassListRow[]; total: number }> {
    let p = new HttpParams()
      .set('limit', String(params?.limit ?? 20))
      .set('page', String(params?.page ?? 1));
    if (params?.status) p = p.set('status', params.status);
    if (params?.transferType) p = p.set('transferType', params.transferType);
    return this.http.get<GetPassListHttpBody>(this.base, { params: p }).pipe(
      map((res) => ({
        passes: res.success && Array.isArray(res.data) ? res.data : [],
        total: res.total ?? 0,
      })),
    );
  }

  getById(id: string): Observable<GetPassDetail> {
    return this.http.get<ApiResponse<GetPassDetail>>(`${this.base}/${id}`).pipe(
      map((res) => {
        if (!res.success || !res.data) throw new Error(res.message || 'Not found');
        return res.data;
      }),
    );
  }

  create(body: GetPassCreatePayload): Observable<GetPassDetail> {
    return this.http.post<ApiResponse<GetPassDetail>>(this.base, body).pipe(
      map((res) => {
        if (!res.success || !res.data) throw new Error(res.message || 'Create failed');
        return res.data;
      }),
    );
  }

  update(id: string, body: GetPassUpdatePayload): Observable<GetPassDetail> {
    return this.http.put<ApiResponse<GetPassDetail>>(`${this.base}/${id}`, body).pipe(
      map((res) => {
        if (!res.success || !res.data) throw new Error(res.message || 'Update failed');
        return res.data;
      }),
    );
  }

  delete(id: string): Observable<void> {
    return this.http.delete<ApiResponse<unknown>>(`${this.base}/${id}`).pipe(
      map((res) => {
        if (!res.success) throw new Error(res.message || 'Delete failed');
      }),
    );
  }

  submit(id: string): Observable<GetPassDetail> {
    return this.http.post<ApiResponse<GetPassDetail>>(`${this.base}/${id}/submit`, {}).pipe(
      map((res) => {
        if (!res.success || !res.data) throw new Error(res.message || 'Submit failed');
        return res.data;
      }),
    );
  }

  approve(id: string, action: 'APPROVE' | 'REJECT', notes?: string | null): Observable<GetPassDetail> {
    return this.http.post<ApiResponse<GetPassDetail>>(`${this.base}/${id}/approve`, { action, notes }).pipe(
      map((res) => {
        if (!res.success || !res.data) throw new Error(res.message || 'Action failed');
        return res.data;
      }),
    );
  }

  checkout(id: string, lines: unknown[] = []): Observable<GetPassDetail> {
    return this.http.post<ApiResponse<GetPassDetail>>(`${this.base}/${id}/checkout`, { lines }).pipe(
      map((res) => {
        if (!res.success || !res.data) throw new Error(res.message || 'Checkout failed');
        return res.data;
      }),
    );
  }

  returnItems(id: string, lines: GetPassReturnLinePayload[], notes?: string | null): Observable<GetPassDetail> {
    return this.http.post<ApiResponse<GetPassDetail>>(`${this.base}/${id}/return`, { lines, notes }).pipe(
      map((res) => {
        if (!res.success || !res.data) throw new Error(res.message || 'Return failed');
        return res.data;
      }),
    );
  }

  close(id: string): Observable<GetPassDetail> {
    return this.http.post<ApiResponse<GetPassDetail>>(`${this.base}/${id}/close`, {}).pipe(
      map((res) => {
        if (!res.success || !res.data) throw new Error(res.message || 'Close failed');
        return res.data;
      }),
    );
  }

  exportPdf(id: string): Observable<Blob> {
    return this.http.get(`${this.base}/${id}/pdf`, { responseType: 'blob' });
  }
}
