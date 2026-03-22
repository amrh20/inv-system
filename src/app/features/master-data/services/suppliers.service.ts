import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../../environments/environment';
import type { ApiResponse } from '../../../core/models/api-response.model';
import type { SupplierPayload, SupplierRow } from '../models/supplier.model';

@Injectable({ providedIn: 'root' })
export class SuppliersService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/suppliers`;

  list(params?: {
    search?: string;
    skip?: number;
    take?: number;
    isActive?: boolean;
  }): Observable<{ suppliers: SupplierRow[]; total: number }> {
    let p = new HttpParams();
    if (params?.search) p = p.set('search', params.search);
    if (params?.skip != null) p = p.set('skip', String(params.skip));
    if (params?.take != null) p = p.set('take', String(params.take));
    if (params?.isActive != null) p = p.set('isActive', String(params.isActive));
    return this.http.get<ApiResponse<SupplierRow[]>>(this.base, { params: p }).pipe(
      map((res) => ({
        suppliers: res.success && Array.isArray(res.data) ? res.data : [],
        total: res.meta?.total ?? 0,
      })),
    );
  }

  getById(id: string): Observable<SupplierRow> {
    return this.http.get<ApiResponse<SupplierRow>>(`${this.base}/${id}`).pipe(
      map((res) => {
        if (!res.success || !res.data) throw new Error(res.message || 'Supplier not found');
        return res.data;
      }),
    );
  }

  create(body: SupplierPayload): Observable<SupplierRow> {
    return this.http.post<ApiResponse<SupplierRow>>(this.base, body).pipe(
      map((res) => {
        if (!res.success || !res.data) throw new Error(res.message || 'Create failed');
        return res.data;
      }),
    );
  }

  update(id: string, body: SupplierPayload): Observable<SupplierRow> {
    return this.http.put<ApiResponse<SupplierRow>>(`${this.base}/${id}`, body).pipe(
      map((res) => {
        if (!res.success || !res.data) throw new Error(res.message || 'Update failed');
        return res.data;
      }),
    );
  }

  toggleStatus(id: string, isActive: boolean): Observable<SupplierRow> {
    return this.http
      .patch<ApiResponse<SupplierRow>>(`${this.base}/${id}/status`, { isActive })
      .pipe(
        map((res) => {
          if (!res.success || !res.data) throw new Error(res.message || 'Toggle failed');
          return res.data;
        }),
      );
  }
}
