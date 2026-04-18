import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, map, throwError } from 'rxjs';
import { environment } from '../../../../environments/environment';
import type { ApiResponse } from '../../../core/models/api-response.model';
import type {
  LostApprovalRequest,
  LostApprovePayload,
  LostCreatePayload,
  LostDetail,
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
    /** Single status, or comma-separated list (e.g. dept manager “In Progress” tab). */
    status?: LostWorkflowStatus | string;
    sourceType?: LostSourceType;
    /** Limit to documents created by this user (dept manager unified list). */
    createdById?: string;
  }): Observable<{ items: LostItemsListRow[]; total: number }> {
    let p = new HttpParams()
      .set('take', String(params?.take ?? 20))
      .set('skip', String(params?.skip ?? 0));
    if (params?.search) p = p.set('search', params.search);
    if (params?.status) p = p.set('status', params.status);
    if (params?.sourceType) p = p.set('sourceType', params.sourceType);
    if (params?.createdById) p = p.set('createdById', params.createdById);
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

  getById(id: string): Observable<LostDetail> {
    return this.http.get<ApiResponse<LostDetail>>(`${this.base}/${id}`).pipe(
      map((res) => {
        if (!res.success || !res.data) throw new Error(res.message || 'Not found');
        return res.data;
      }),
    );
  }

  approveDept(id: string, body?: LostApprovePayload): Observable<LostItemsListRow> {
    return this.http.post<ApiResponse<LostItemsListRow>>(`${this.base}/${id}/approve-dept`, body ?? {}).pipe(
      map((res) => {
        if (!res.success || !res.data) throw new Error(res.message || 'Department approval failed');
        return res.data;
      }),
    );
  }

  approveCost(id: string, body?: LostApprovePayload): Observable<LostItemsListRow> {
    return this.http.post<ApiResponse<LostItemsListRow>>(`${this.base}/${id}/approve-cost`, body ?? {}).pipe(
      map((res) => {
        if (!res.success || !res.data) throw new Error(res.message || 'Cost approval failed');
        return res.data;
      }),
    );
  }

  approveFinance(id: string, body?: LostApprovePayload): Observable<LostItemsListRow> {
    return this.http.post<ApiResponse<LostItemsListRow>>(`${this.base}/${id}/approve-finance`, body ?? {}).pipe(
      map((res) => {
        if (!res.success || !res.data) throw new Error(res.message || 'Finance approval failed');
        return res.data;
      }),
    );
  }

  approveGm(id: string, body?: LostApprovePayload): Observable<LostItemsListRow> {
    return this.http.post<ApiResponse<LostItemsListRow>>(`${this.base}/${id}/approve-gm`, body ?? {}).pipe(
      map((res) => {
        if (!res.success || !res.data) throw new Error(res.message || 'GM approval failed');
        return res.data;
      }),
    );
  }

  /**
   * POST `/lost/:id/approve` — ApprovalRequest chain (get-pass return, or any lost doc with a workflow record).
   * Same contract as breakage `/approve`.
   */
  approveWorkflowStep(
    id: string,
    body?: LostApprovePayload & { comment?: string | null },
  ): Observable<LostDetail> {
    return this.http.post<ApiResponse<LostDetail>>(`${this.base}/${id}/approve`, body ?? {}).pipe(
      map((res) => {
        if (!res.success || !res.data) throw new Error(res.message || 'Approve failed');
        return res.data;
      }),
    );
  }

  /**
   * Routes to unified `/approve` for {@link LostSourceType.GET_PASS_RETURN} or when an `approvalRequest` exists;
   * otherwise uses legacy dept → cost → finance → GM endpoints (purely internal lost without workflow).
   */
  approveAtCurrentStep(
    id: string,
    ctx: {
      sourceType: LostSourceType;
      status: LostWorkflowStatus;
      approvalRequests?: LostApprovalRequest[] | null | undefined;
    },
    body?: LostApprovePayload & { comment?: string | null },
  ): Observable<LostDetail | LostItemsListRow> {
    const unified =
      ctx.sourceType === 'GET_PASS_RETURN' ||
      (Array.isArray(ctx.approvalRequests) && ctx.approvalRequests.length > 0);
    if (unified) {
      return this.approveWorkflowStep(id, body);
    }
    const s = ctx.status;
    if (s === 'DRAFT') return this.approveDept(id, body);
    if (s === 'DEPT_APPROVED') return this.approveCost(id, body);
    if (s === 'COST_CONTROL_APPROVED') return this.approveFinance(id, body);
    if (s === 'FINANCE_APPROVED') return this.approveGm(id, body);
    return throwError(() => new Error('Approve failed'));
  }

  rejectWorkflowStep(id: string, comment: string): Observable<LostDetail> {
    return this.http.post<ApiResponse<LostDetail>>(`${this.base}/${id}/reject`, { comment }).pipe(
      map((res) => {
        if (!res.success || !res.data) throw new Error(res.message || 'Reject failed');
        return res.data;
      }),
    );
  }
}
