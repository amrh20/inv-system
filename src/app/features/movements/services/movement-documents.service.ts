import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../../environments/environment';
import type { ApiResponse } from '../../../core/models/api-response.model';
import type {
  MovementDocumentDetail,
  MovementDocumentPayload,
  MovementDocumentRow,
} from '../models/movement-document.model';

export interface MovementDocumentsListParams {
  skip?: number;
  take?: number;
  search?: string;
}

@Injectable({ providedIn: 'root' })
export class MovementDocumentsService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/movements`;

  list(params: MovementDocumentsListParams = {}): Observable<{ documents: MovementDocumentRow[]; total: number }> {
    let httpParams = new HttpParams();
    if (params.skip != null) {
      httpParams = httpParams.set('skip', String(params.skip));
    }
    if (params.take != null) {
      httpParams = httpParams.set('take', String(params.take));
    }
    if (params.search) {
      httpParams = httpParams.set('search', params.search);
    }
    return this.http.get<ApiResponse<MovementDocumentRow[]>>(this.base, { params: httpParams }).pipe(
      map((res) => ({
        documents: res.success && Array.isArray(res.data) ? res.data : [],
        total: res.meta?.total ?? 0,
      })),
    );
  }

  getById(id: string): Observable<MovementDocumentDetail> {
    return this.http.get<ApiResponse<MovementDocumentDetail>>(`${this.base}/${id}`).pipe(
      map((res) => {
        if (!res.success || !res.data) {
          throw new Error(res.message || 'Movement not found');
        }
        return res.data;
      }),
    );
  }

  create(payload: MovementDocumentPayload): Observable<MovementDocumentDetail> {
    return this.http.post<ApiResponse<MovementDocumentDetail>>(this.base, payload).pipe(
      map((res) => {
        if (!res.success || !res.data) {
          throw new Error(res.message || 'Create failed');
        }
        return res.data;
      }),
    );
  }

  update(id: string, payload: MovementDocumentPayload): Observable<MovementDocumentDetail> {
    return this.http.put<ApiResponse<MovementDocumentDetail>>(`${this.base}/${id}`, payload).pipe(
      map((res) => {
        if (!res.success || !res.data) {
          throw new Error(res.message || 'Update failed');
        }
        return res.data;
      }),
    );
  }

  post(id: string): Observable<MovementDocumentDetail> {
    return this.http.post<ApiResponse<MovementDocumentDetail>>(`${this.base}/${id}/post`, {}).pipe(
      map((res) => {
        if (!res.success || !res.data) {
          throw new Error(res.message || 'Post failed');
        }
        return res.data;
      }),
    );
  }
}
