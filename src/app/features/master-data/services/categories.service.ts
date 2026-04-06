import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../../environments/environment';
import type { ApiResponse } from '../../../core/models/api-response.model';
import type {
  CategoryPayload,
  CategoryRow,
  SubcategoryPayload,
  SubcategoryRow,
} from '../models/category.model';

@Injectable({ providedIn: 'root' })
export class CategoriesService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/categories`;

  list(params?: {
    search?: string;
    skip?: number;
    take?: number;
    isActive?: boolean;
    departmentId?: string;
    departmentIds?: string;
    tenantId?: string;
  }): Observable<{ categories: CategoryRow[]; total: number }> {
    let p = new HttpParams();
    if (params?.search) p = p.set('search', params.search);
    if (params?.skip != null) p = p.set('skip', String(params.skip));
    if (params?.take != null) p = p.set('take', String(params.take));
    if (params?.isActive != null) p = p.set('isActive', String(params.isActive));
    if (params?.departmentId) p = p.set('departmentId', params.departmentId);
    if (params?.departmentIds) p = p.set('departmentIds', params.departmentIds);
    if (params?.tenantId) p = p.set('tenantId', params.tenantId);
    return this.http.get<ApiResponse<CategoryRow[]>>(this.base, { params: p }).pipe(
      map((res) => {
        const data = res.data as unknown;
        const rec = data as Record<string, unknown>;
        const arr: CategoryRow[] = Array.isArray(data)
          ? (data as CategoryRow[])
          : Array.isArray(rec['categories'])
            ? (rec['categories'] as CategoryRow[])
            : Array.isArray(rec['data'])
              ? (rec['data'] as CategoryRow[])
              : [];
        return {
          categories: res.success ? arr : [],
          total: res.meta?.total ?? arr.length,
        };
      }),
    );
  }

  create(body: CategoryPayload): Observable<CategoryRow> {
    return this.http.post<ApiResponse<CategoryRow>>(this.base, body).pipe(
      map((res) => {
        if (!res.success || !res.data) throw new Error(res.message || 'Create failed');
        return res.data;
      }),
    );
  }

  update(id: string, body: CategoryPayload): Observable<CategoryRow> {
    return this.http.put<ApiResponse<CategoryRow>>(`${this.base}/${id}`, body).pipe(
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

  createSubcategory(categoryId: string, body: SubcategoryPayload): Observable<SubcategoryRow> {
    return this.http
      .post<ApiResponse<SubcategoryRow>>(`${this.base}/${categoryId}/subcategories`, body)
      .pipe(
        map((res) => {
          if (!res.success || !res.data) throw new Error(res.message || 'Create subcategory failed');
          return res.data;
        }),
      );
  }

  updateSubcategory(subcategoryId: string, body: SubcategoryPayload): Observable<SubcategoryRow> {
    return this.http
      .put<ApiResponse<SubcategoryRow>>(`${this.base}/subcategories/${subcategoryId}`, body)
      .pipe(
        map((res) => {
          if (!res.success || !res.data) throw new Error(res.message || 'Update subcategory failed');
          return res.data;
        }),
      );
  }

  deleteSubcategory(subcategoryId: string): Observable<void> {
    return this.http
      .delete<ApiResponse<null>>(`${this.base}/subcategories/${subcategoryId}`)
      .pipe(
        map((res) => {
          if (!res.success) throw new Error(res.message || 'Delete subcategory failed');
        }),
      );
  }
}
