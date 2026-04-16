import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../../environments/environment';
import type { ApiResponse } from '../../../core/models/api-response.model';
import type {
  BreakageCreatePayload,
  BreakageDetail,
  BreakageListRow,
  BreakageSourceType,
  BreakageWorkflowStatus,
} from '../models/breakage.model';

@Injectable({ providedIn: 'root' })
export class BreakageService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/breakage`;

  list(params?: {
    skip?: number;
    take?: number;
    status?: BreakageWorkflowStatus;
    search?: string;
    sourceType?: BreakageSourceType;
  }): Observable<{ documents: BreakageListRow[]; total: number }> {
    let p = new HttpParams()
      .set('take', String(params?.take ?? 15))
      .set('skip', String(params?.skip ?? 0));
    if (params?.status) p = p.set('status', params.status);
    if (params?.search) p = p.set('search', params.search);
    if (params?.sourceType) p = p.set('sourceType', params.sourceType);
    return this.http.get<ApiResponse<BreakageListRow[]>>(this.base, { params: p }).pipe(
      map((res) => ({
        documents: res.success && Array.isArray(res.data) ? res.data : [],
        total: res.meta?.total ?? 0,
      })),
    );
  }

  getById(id: string): Observable<BreakageDetail> {
    return this.http.get<ApiResponse<BreakageDetail>>(`${this.base}/${id}`).pipe(
      map((res) => {
        if (!res.success || !res.data) throw new Error(res.message || 'Not found');
        return res.data;
      }),
    );
  }

  create(body: BreakageCreatePayload): Observable<BreakageDetail> {
    return this.http.post<ApiResponse<BreakageDetail>>(this.base, body).pipe(
      map((res) => {
        if (!res.success || !res.data) throw new Error(res.message || 'Create failed');
        return res.data;
      }),
    );
  }

  submit(id: string): Observable<BreakageDetail> {
    return this.http.post<ApiResponse<BreakageDetail>>(`${this.base}/${id}/submit`, {}).pipe(
      map((res) => {
        if (!res.success || !res.data) throw new Error(res.message || 'Submit failed');
        return res.data;
      }),
    );
  }

  approve(id: string, comment?: string | null): Observable<BreakageDetail> {
    return this.http.post<ApiResponse<BreakageDetail>>(`${this.base}/${id}/approve`, { comment }).pipe(
      map((res) => {
        if (!res.success || !res.data) throw new Error(res.message || 'Approve failed');
        return res.data;
      }),
    );
  }

  reject(id: string, comment: string): Observable<BreakageDetail> {
    return this.http.post<ApiResponse<BreakageDetail>>(`${this.base}/${id}/reject`, { comment }).pipe(
      map((res) => {
        if (!res.success || !res.data) throw new Error(res.message || 'Reject failed');
        return res.data;
      }),
    );
  }

  voidDocument(id: string): Observable<BreakageDetail> {
    return this.http.post<ApiResponse<BreakageDetail>>(`${this.base}/${id}/void`, {}).pipe(
      map((res) => {
        if (!res.success || !res.data) throw new Error(res.message || 'Void failed');
        return res.data;
      }),
    );
  }

  uploadAttachment(id: string, file: File): Observable<BreakageDetail> {
    const fd = new FormData();
    fd.append('file', file);
    return this.http.post<ApiResponse<BreakageDetail>>(`${this.base}/${id}/attachment`, fd).pipe(
      map((res) => {
        if (!res.success || !res.data) throw new Error(res.message || 'Upload failed');
        return res.data;
      }),
    );
  }

  evidenceJson(id: string): Observable<unknown> {
    return this.http.get<ApiResponse<unknown>>(`${this.base}/${id}/evidence`).pipe(
      map((res) => {
        if (!res.success) throw new Error(res.message || 'Failed');
        return res.data;
      }),
    );
  }

  downloadEvidencePdf(id: string): Observable<Blob> {
    return this.http.get(`${this.base}/${id}/evidence/pdf`, { responseType: 'blob' });
  }
}
