import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../../environments/environment';
import type { ApiResponse } from '../../../core/models/api-response.model';
import type {
  TransferCreatePayload,
  TransferDetail,
  TransferListApiPayload,
  TransferListRow,
  TransferUpdatePayload,
} from '../models/transfer.model';

@Injectable({ providedIn: 'root' })
export class TransferService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/transfers`;

  list(params?: { status?: string; page?: number; limit?: number }): Observable<{
    transfers: TransferListRow[];
    total: number;
  }> {
    let p = new HttpParams()
      .set('limit', String(params?.limit ?? 50))
      .set('page', String(params?.page ?? 1));
    if (params?.status) p = p.set('status', params.status);
    return this.http.get<ApiResponse<TransferListApiPayload>>(this.base, { params: p }).pipe(
      map((res) => {
        const d = res.data;
        if (d && Array.isArray(d.data)) {
          return { transfers: d.data, total: d.total ?? 0 };
        }
        return { transfers: [], total: 0 };
      }),
    );
  }

  getById(id: string): Observable<TransferDetail> {
    return this.http.get<ApiResponse<TransferDetail>>(`${this.base}/${id}`).pipe(
      map((res) => {
        if (!res.success || !res.data) {
          throw new Error(res.message || 'Transfer not found');
        }
        return res.data;
      }),
    );
  }

  create(body: TransferCreatePayload): Observable<TransferDetail> {
    return this.http.post<ApiResponse<TransferDetail>>(this.base, body).pipe(
      map((res) => {
        if (!res.success || !res.data) {
          throw new Error(res.message || 'Create failed');
        }
        return res.data;
      }),
    );
  }

  update(id: string, body: TransferUpdatePayload): Observable<TransferDetail> {
    return this.http.patch<ApiResponse<TransferDetail>>(`${this.base}/${id}`, body).pipe(
      map((res) => {
        if (!res.success || !res.data) {
          throw new Error(res.message || 'Update failed');
        }
        return res.data;
      }),
    );
  }

  delete(id: string): Observable<void> {
    return this.http.delete<ApiResponse<unknown>>(`${this.base}/${id}`).pipe(
      map((res) => {
        if (!res.success) {
          throw new Error(res.message || 'Delete failed');
        }
      }),
    );
  }

  postAction(
    id: string,
    endpoint: 'submit' | 'approve' | 'reject' | 'dispatch' | 'receive',
    body?: unknown,
  ): Observable<void> {
    return this.http.post<ApiResponse<unknown>>(`${this.base}/${id}/${endpoint}`, body ?? {}).pipe(
      map((res) => {
        if (!res.success) {
          throw new Error(res.message || 'Action failed');
        }
      }),
    );
  }
}
