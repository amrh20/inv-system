import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../../environments/environment';
import type { ApiResponse } from '../../../core/models/api-response.model';
import type { CategoryRow } from '../models/category.model';
import type { LocationPayload, LocationRow } from '../models/location.model';

@Injectable({ providedIn: 'root' })
export class LocationsService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/locations`;

  list(params?: {
    search?: string;
    skip?: number;
    take?: number;
    type?: string;
    isActive?: boolean;
    departmentId?: string;
    categoryId?: string;
    /** Lighter list payload when supported by the API (`meta` may be omitted). */
    slim?: boolean;
  }): Observable<{ locations: LocationRow[]; total: number }> {
    let p = new HttpParams();
    if (params?.search) p = p.set('search', params.search);
    if (params?.skip != null) p = p.set('skip', String(params.skip));
    if (params?.take != null) p = p.set('take', String(params.take));
    if (params?.type) p = p.set('type', params.type);
    if (params?.isActive != null) p = p.set('isActive', String(params.isActive));
    if (params?.departmentId) p = p.set('departmentId', params.departmentId);
    if (params?.categoryId) p = p.set('categoryId', params.categoryId);
    if (params?.slim === true) p = p.set('slim', 'true');
    return this.http.get<ApiResponse<LocationRow[] | LocationRow>>(this.base, { params: p }).pipe(
      map((res) => {
        const raw = res.success ? res.data : null;
        const locations = Array.isArray(raw)
          ? raw
          : raw != null && typeof raw === 'object'
            ? [raw as LocationRow]
            : [];
        return {
          locations,
          total: res.meta?.total ?? locations.length,
        };
      }),
    );
  }

  getById(id: string): Observable<LocationRow> {
    return this.http.get<ApiResponse<LocationRow>>(`${this.base}/${id}`).pipe(
      map((res) => {
        if (!res.success || !res.data) throw new Error(res.message || 'Location not found');
        return res.data;
      }),
    );
  }

  create(body: LocationPayload): Observable<LocationRow> {
    return this.http.post<ApiResponse<LocationRow>>(this.base, body).pipe(
      map((res) => {
        if (!res.success || !res.data) throw new Error(res.message || 'Create failed');
        return res.data;
      }),
    );
  }

  update(id: string, body: LocationPayload): Observable<LocationRow> {
    return this.http.put<ApiResponse<LocationRow>>(`${this.base}/${id}`, body).pipe(
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

  getCategories(id: string): Observable<CategoryRow[]> {
    return this.http
      .get<ApiResponse<CategoryRow[]>>(`${this.base}/${id}/categories`)
      .pipe(
        map((res) => (res.success && Array.isArray(res.data) ? res.data : [])),
      );
  }

  setCategories(id: string, categoryIds: string[]): Observable<void> {
    return this.http
      .put<ApiResponse<null>>(`${this.base}/${id}/categories`, { categoryIds })
      .pipe(
        map((res) => {
          if (!res.success) throw new Error(res.message || 'Set categories failed');
        }),
      );
  }
}
