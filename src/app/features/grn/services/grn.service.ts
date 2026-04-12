import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../../environments/environment';
import type { ApiResponse } from '../../../core/models/api-response.model';
import type {
  GrnCreateLinePayload,
  GrnDetail,
  GrnImportPreviewData,
  GrnListApiPayload,
  GrnListRow,
} from '../models/grn.model';

@Injectable({ providedIn: 'root' })
export class GrnService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/grn`;

  /**
   * List GRNs — backend returns `{ data: { data: rows[], total } }` (React `GrnListPage`).
   */
  list(params?: { status?: string; page?: number; limit?: number }): Observable<{ grns: GrnListRow[]; total: number }> {
    let p = new HttpParams();
    if (params?.status) p = p.set('status', params.status);
    if (params?.page != null) p = p.set('page', String(params.page));
    if (params?.limit != null) p = p.set('limit', String(params.limit));
    return this.http.get<ApiResponse<GrnListApiPayload | GrnListRow[]>>(this.base, { params: p }).pipe(
      map((res) => {
        const payload = res.data;
        if (payload && typeof payload === 'object' && 'data' in payload && Array.isArray((payload as GrnListApiPayload).data)) {
          const inner = payload as GrnListApiPayload;
          return { grns: inner.data, total: inner.total ?? 0 };
        }
        if (Array.isArray(payload)) {
          return { grns: payload, total: res.meta?.total ?? payload.length };
        }
        return { grns: [], total: 0 };
      }),
    );
  }

  getById(id: string): Observable<GrnDetail> {
    return this.http.get<ApiResponse<GrnDetail>>(`${this.base}/${id}`).pipe(
      map((res) => {
        if (!res.success || !res.data) {
          throw new Error(res.message || 'GRN not found');
        }
        return res.data;
      }),
    );
  }

  /**
   * Multipart create — same fields as React `GrnCreateModal` `handleSubmit`.
   * ADMIN: backend may auto-post; check `autoPosted` and navigate to POSTED/detail.
   */
  create(formData: FormData): Observable<{
    id: string;
    autoPosted: boolean;
    message?: string;
  }> {
    return this.http.post<ApiResponse<GrnDetail & { autoPosted?: boolean }>>(this.base, formData).pipe(
      map((res) => {
        if (!res.success || !res.data) {
          throw new Error(res.message || 'Create failed');
        }
        const data = res.data;
        const autoPosted = res.autoPosted === true || data.autoPosted === true;
        return {
          id: data.id,
          autoPosted,
          message: res.message,
        };
      }),
    );
  }

  importPreview(formData: FormData): Observable<GrnImportPreviewData> {
    return this.http
      .post<ApiResponse<GrnImportPreviewData>>(`${this.base}/import/preview`, formData)
      .pipe(
        map((res) => {
          if (!res.success || res.data == null) {
            throw new Error(res.message || 'Preview failed');
          }
          return res.data;
        }),
      );
  }

  downloadTemplate(): Observable<Blob> {
    return this.http.get(`${this.base}/template`, { responseType: 'blob' });
  }

  postAction(id: string, endpoint: 'validate' | 'submit' | 'approve' | 'reject' | 'post', body?: unknown): Observable<void> {
    return this.http.post<ApiResponse<unknown>>(`${this.base}/${id}/${endpoint}`, body ?? {}).pipe(
      map((res) => {
        if (!res.success) {
          throw new Error(res.message || 'Action failed');
        }
      }),
    );
  }

  /** PATCH /grn/:id/status — VALIDATED → APPROVED | REJECTED (Cost Control / Admin). */
  updateStatus(
    id: string,
    body: { status: 'APPROVED' | 'REJECTED'; reason?: string },
  ): Observable<void> {
    return this.http.patch<ApiResponse<unknown>>(`${this.base}/${id}/status`, body).pipe(
      map((res) => {
        if (!res.success) {
          throw new Error(res.message || 'Status update failed');
        }
      }),
    );
  }

  /**
   * PATCH /grn/:id — `lines` replaces all lines only when GRN status is REJECTED; optional `notes`.
   */
  patch(
    id: string,
    body: { notes?: string | null; lines?: GrnCreateLinePayload[] },
  ): Observable<GrnDetail> {
    return this.http.patch<ApiResponse<GrnDetail>>(`${this.base}/${id}`, body).pipe(
      map((res) => {
        if (!res.success || !res.data) {
          throw new Error(res.message || 'Update failed');
        }
        return res.data;
      }),
    );
  }

  /** POST /grn/:id/resubmit — REJECTED → VALIDATED (storekeeper) or APPROVED (cost control / admin). */
  resubmit(id: string): Observable<void> {
    return this.http.post<ApiResponse<unknown>>(`${this.base}/${id}/resubmit`, {}).pipe(
      map((res) => {
        if (!res.success) {
          throw new Error(res.message || 'Resubmit failed');
        }
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
}
