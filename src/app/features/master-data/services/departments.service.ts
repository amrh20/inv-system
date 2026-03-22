import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../../environments/environment';
import type { ApiResponse } from '../../../core/models/api-response.model';
import type { DepartmentPayload, DepartmentRow } from '../models/department.model';

@Injectable({ providedIn: 'root' })
export class DepartmentsService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/departments`;

  list(params?: {
    search?: string;
    skip?: number;
    take?: number;
    isActive?: boolean;
  }): Observable<{ departments: DepartmentRow[]; total: number }> {
    let p = new HttpParams();
    if (params?.search) p = p.set('search', params.search);
    if (params?.skip != null) p = p.set('skip', String(params.skip));
    if (params?.take != null) p = p.set('take', String(params.take));
    if (params?.isActive != null) p = p.set('isActive', String(params.isActive));
    return this.http.get<ApiResponse<DepartmentRow[]>>(this.base, { params: p }).pipe(
      map((res) => ({
        departments: res.success && Array.isArray(res.data) ? res.data : [],
        total: res.meta?.total ?? 0,
      })),
    );
  }

  getById(id: string): Observable<DepartmentRow> {
    return this.http.get<ApiResponse<DepartmentRow>>(`${this.base}/${id}`).pipe(
      map((res) => {
        if (!res.success || !res.data) throw new Error(res.message || 'Department not found');
        return res.data;
      }),
    );
  }

  create(body: DepartmentPayload): Observable<DepartmentRow> {
    return this.http.post<ApiResponse<DepartmentRow>>(this.base, body).pipe(
      map((res) => {
        if (!res.success || !res.data) throw new Error(res.message || 'Create failed');
        return res.data;
      }),
    );
  }

  update(id: string, body: DepartmentPayload): Observable<DepartmentRow> {
    return this.http.put<ApiResponse<DepartmentRow>>(`${this.base}/${id}`, body).pipe(
      map((res) => {
        if (!res.success || !res.data) throw new Error(res.message || 'Update failed');
        return res.data;
      }),
    );
  }

  delete(id: string): Observable<void> {
    return this.http.delete<ApiResponse<null>>(`${this.base}/${id}`).pipe(
      map((res) => {
        if (!res.success) throw new Error(res.message || 'Delete failed');
      }),
    );
  }

  toggleActive(id: string): Observable<DepartmentRow> {
    return this.http.patch<ApiResponse<DepartmentRow>>(`${this.base}/${id}/toggle`, {}).pipe(
      map((res) => {
        if (!res.success || !res.data) throw new Error(res.message || 'Toggle failed');
        return res.data;
      }),
    );
  }
}
