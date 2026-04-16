import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../../environments/environment';
import type { ApiResponse } from '../../../core/models/api-response.model';
import type {
  GetPassAcceptReturnIntoDepartmentPayload,
  GetPassAcceptIntoDepartmentPayload,
  GetPassConfirmReturnArrivalPayload,
  GetPassConfirmReceiptPayload,
  GetPassCreatePayload,
  GetPassDiscrepancyRow,
  GetPassDetail,
  GetPassListRow,
  GetPassReturnLinePayload,
  GetPassUpdatePayload,
  SisterHotelRow,
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
  private readonly orgBase = `${environment.apiUrl}/organization`;

  /**
   * Sister properties under the same organization (for internal transfers).
   * The API authorizes by permission (`GET_PASS_CREATE` / `GET_PASS_VIEW`), not by role:
   * any user whose JWT tenant is part of a group receives the same sibling list.
   * Response rows may use `id` or `tenantId`, and `name` or `tenantName`.
   */
  getSisterHotels(): Observable<SisterHotelRow[]> {
    return this.http.get<ApiResponse<unknown>>(`${this.orgBase}/sister-hotels`).pipe(
      map((res) => {
        if (!res.success || !Array.isArray(res.data)) return [];
        const out: SisterHotelRow[] = [];
        for (const raw of res.data) {
          if (!raw || typeof raw !== 'object') continue;
          const row = raw as Record<string, unknown>;
          const id =
            (typeof row['id'] === 'string' && row['id']) ||
            (typeof row['tenantId'] === 'string' && row['tenantId']) ||
            '';
          if (!id) continue;
          const name =
            (typeof row['name'] === 'string' && row['name']) ||
            (typeof row['tenantName'] === 'string' && row['tenantName']) ||
            id;
          out.push({ id, name });
        }
        return out;
      }),
    );
  }

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

  /** Internal transfers addressed to the current tenant (sister hotel). */
  getIncomingPasses(params?: { page?: number; limit?: number }): Observable<{
    passes: GetPassListRow[];
    total: number;
  }> {
    let p = new HttpParams()
      .set('limit', String(params?.limit ?? 20))
      .set('page', String(params?.page ?? 1));
    return this.http.get<GetPassListHttpBody>(`${this.base}/incoming`, { params: p }).pipe(
      map((res) => ({
        passes: res.success && Array.isArray(res.data) ? res.data : [],
        total: res.total ?? 0,
      })),
    );
  }

  /**
   * Source hotel returns currently in reverse transit and related return lifecycle statuses.
   */
  getReturningPasses(params?: {
    page?: number;
    limit?: number;
    status?: string[];
  }): Observable<{
    passes: GetPassListRow[];
    total: number;
  }> {
    let p = new HttpParams()
      .set('limit', String(params?.limit ?? 20))
      .set('page', String(params?.page ?? 1));
    if (params?.status && params.status.length > 0) {
      for (const s of params.status) {
        p = p.append('status', s);
      }
    }
    return this.http.get<GetPassListHttpBody>(`${this.base}/returns`, { params: p }).pipe(
      map((res) => ({
        passes: res.success && Array.isArray(res.data) ? res.data : [],
        total: res.total ?? 0,
      })),
    );
  }

  confirmReceipt(id: string, payload: GetPassConfirmReceiptPayload): Observable<GetPassDetail> {
    return this.http
      .post<ApiResponse<GetPassDetail>>(`${this.base}/${id}/confirm-receipt`, payload)
      .pipe(
        map((res) => {
          if (!res.success || !res.data) throw new Error(res.message || 'Confirm receipt failed');
          return res.data;
        }),
      );
  }

  acceptIntoDepartment(
    id: string,
    payload: GetPassAcceptIntoDepartmentPayload,
  ): Observable<GetPassDetail> {
    return this.http
      .post<ApiResponse<GetPassDetail>>(`${this.base}/${id}/accept-into-department`, payload)
      .pipe(
        map((res) => {
          if (!res.success || !res.data) throw new Error(res.message || 'Accept into department failed');
          return res.data;
        }),
      );
  }

  /**
   * Destination hotel starts reverse logistics to return items to source security.
   */
  shipBack(id: string): Observable<GetPassDetail> {
    return this.http.post<ApiResponse<GetPassDetail>>(`${this.base}/${id}/ship-back`, {}).pipe(
      map((res) => {
        if (!res.success || !res.data) throw new Error(res.message || 'Ship back failed');
        return res.data;
      }),
    );
  }

  /**
   * Destination hotel security confirms reverse shipment exit from gate.
   */
  confirmReturnExit(id: string): Observable<GetPassDetail> {
    return this.http.post<ApiResponse<GetPassDetail>>(`${this.base}/${id}/confirm-return-exit`, {}).pipe(
      map((res) => {
        if (!res.success || !res.data) throw new Error(res.message || 'Confirm return exit failed');
        return res.data;
      }),
    );
  }

  /**
   * Source hotel security confirms returned items arrived back.
   */
  confirmReturnArrival(
    id: string,
    payload: GetPassConfirmReturnArrivalPayload,
  ): Observable<GetPassDetail> {
    return this.http.post<ApiResponse<GetPassDetail>>(`${this.base}/${id}/confirm-return-arrival`, payload).pipe(
      map((res) => {
        if (!res.success || !res.data) throw new Error(res.message || 'Confirm arrival failed');
        return res.data;
      }),
    );
  }

  acceptReturnIntoDepartment(
    id: string,
    payload?: GetPassAcceptReturnIntoDepartmentPayload,
  ): Observable<GetPassDetail> {
    return this.http
      .post<ApiResponse<GetPassDetail>>(`${this.base}/${id}/accept-return-into-department`, payload ?? {})
      .pipe(
      map((res) => {
        if (!res.success || !res.data) throw new Error(res.message || 'Accept return into department failed');
        return res.data;
      }),
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

  approve(id: string): Observable<GetPassDetail> {
    return this.http.post<ApiResponse<GetPassDetail>>(`${this.base}/${id}/approve`, {}).pipe(
      map((res) => {
        if (!res.success || !res.data) throw new Error(res.message || 'Approve failed');
        return res.data;
      }),
    );
  }

  reject(id: string, rejectionReason: string): Observable<GetPassDetail> {
    return this.http.post<ApiResponse<GetPassDetail>>(`${this.base}/${id}/reject`, { rejectionReason }).pipe(
      map((res) => {
        if (!res.success || !res.data) throw new Error(res.message || 'Reject failed');
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

  getDiscrepancies(): Observable<GetPassDiscrepancyRow[]> {
    return this.http.get<ApiResponse<GetPassDiscrepancyRow[]>>(`${this.base}/discrepancies`).pipe(
      map((res) => {
        if (!res.success || !Array.isArray(res.data)) return [];
        return res.data;
      }),
    );
  }
}
