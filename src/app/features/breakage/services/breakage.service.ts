import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, map, throwError } from 'rxjs';
import { environment } from '../../../../environments/environment';
import type { ApiResponse } from '../../../core/models/api-response.model';
import type { ReturnsAccountabilityType } from '../../../shared/models/returns-accountability.model';
import type {
  BreakageApprovalRequest,
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
    /** Single status, or comma-separated list (e.g. dept manager “In Progress” tab). */
    status?: BreakageWorkflowStatus | string;
    search?: string;
    sourceType?: BreakageSourceType;
    /** Limit to documents created by this user (dept manager unified list). */
    createdById?: string;
  }): Observable<{ documents: BreakageListRow[]; total: number }> {
    let p = new HttpParams()
      .set('take', String(params?.take ?? 15))
      .set('skip', String(params?.skip ?? 0));
    if (params?.status) p = p.set('status', params.status);
    if (params?.search) p = p.set('search', params.search);
    if (params?.sourceType) p = p.set('sourceType', params.sourceType);
    if (params?.createdById) p = p.set('createdById', params.createdById);
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
    const formData = new FormData();
    formData.append('sourceLocationId', body.sourceLocationId);
    formData.append('reason', body.reason);
    if (body.notes) formData.append('notes', body.notes);
    if (body.documentDate) formData.append('documentDate', body.documentDate);
    formData.append('suggestedAction', body.suggestedAction);
    if (body.responsibleEmployeeName) {
      formData.append('responsibleEmployeeName', body.responsibleEmployeeName);
    }
    formData.append('lines', JSON.stringify(body.lines));
    if (body.photo) formData.append('photo', body.photo);
    return this.http.post<ApiResponse<BreakageDetail>>(this.base, formData).pipe(
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

  /**
   * POST `/breakage/:id/approve` — ApprovalRequest chain (incl. get-pass return breakage).
   */
  approve(
    id: string,
    payload?: { comment?: string | null; accountability?: ReturnsAccountabilityType },
  ): Observable<BreakageDetail> {
    return this.http.post<ApiResponse<BreakageDetail>>(`${this.base}/${id}/approve`, payload ?? {}).pipe(
      map((res) => {
        if (!res.success || !res.data) throw new Error(res.message || 'Approve failed');
        return res.data;
      }),
    );
  }

  approveDept(
    id: string,
    body?: { comment?: string | null; accountability?: ReturnsAccountabilityType },
  ): Observable<BreakageDetail> {
    return this.http.post<ApiResponse<BreakageDetail>>(`${this.base}/${id}/approve-dept`, body ?? {}).pipe(
      map((res) => {
        if (!res.success || !res.data) throw new Error(res.message || 'Department approval failed');
        return res.data;
      }),
    );
  }

  approveCost(
    id: string,
    body?: { comment?: string | null; accountability?: ReturnsAccountabilityType },
  ): Observable<BreakageDetail> {
    return this.http.post<ApiResponse<BreakageDetail>>(`${this.base}/${id}/approve-cost`, body ?? {}).pipe(
      map((res) => {
        if (!res.success || !res.data) throw new Error(res.message || 'Cost approval failed');
        return res.data;
      }),
    );
  }

  approveFinance(
    id: string,
    body?: { comment?: string | null; accountability?: ReturnsAccountabilityType },
  ): Observable<BreakageDetail> {
    return this.http.post<ApiResponse<BreakageDetail>>(`${this.base}/${id}/approve-finance`, body ?? {}).pipe(
      map((res) => {
        if (!res.success || !res.data) throw new Error(res.message || 'Finance approval failed');
        return res.data;
      }),
    );
  }

  approveGm(
    id: string,
    body?: { comment?: string | null; accountability?: ReturnsAccountabilityType },
  ): Observable<BreakageDetail> {
    return this.http.post<ApiResponse<BreakageDetail>>(`${this.base}/${id}/approve-gm`, body ?? {}).pipe(
      map((res) => {
        if (!res.success || !res.data) throw new Error(res.message || 'GM approval failed');
        return res.data;
      }),
    );
  }

  /**
   * Unified `/approve` for get-pass returns or any row with an approval request; legacy approve-dept/cost/…
   * for purely internal breakage without a workflow record.
   */
  approveAtCurrentStep(
    id: string,
    ctx: {
      sourceType?: BreakageSourceType;
      status: BreakageWorkflowStatus | string;
      approvalRequests?: BreakageApprovalRequest[] | null | undefined;
    },
    body?: { comment?: string | null; accountability?: ReturnsAccountabilityType },
  ): Observable<BreakageDetail> {
    const unified =
      ctx.sourceType === 'GET_PASS_RETURN' ||
      (Array.isArray(ctx.approvalRequests) && ctx.approvalRequests.length > 0);
    if (unified) {
      return this.approve(id, body);
    }
    const s = ctx.status;
    if (s === 'DRAFT') return this.approveDept(id, body);
    if (s === 'DEPT_APPROVED') return this.approveCost(id, body);
    if (s === 'COST_CONTROL_APPROVED') return this.approveFinance(id, body);
    if (s === 'FINANCE_APPROVED') return this.approveGm(id, body);
    return throwError(() => new Error('Approve failed'));
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
