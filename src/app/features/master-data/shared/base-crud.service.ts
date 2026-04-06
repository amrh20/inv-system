import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of, map } from 'rxjs';
import type { ApiResponse } from '../../../core/models/api-response.model';

export interface ListQuery {
  search?: string;
  skip?: number;
  take?: number;
  isActive?: boolean;
  [key: string]: string | number | boolean | undefined;
}

export interface ListResult<TRow> {
  items: TRow[];
  total: number;
}

export abstract class BaseCrudService<TRow, TPayload extends object> {
  constructor(
    protected readonly http: HttpClient,
    protected readonly baseUrl: string,
  ) {}

  list(params?: ListQuery): Observable<ListResult<TRow>> {
    let httpParams = new HttpParams();
    for (const [key, value] of Object.entries(params ?? {})) {
      if (value != null && value !== '') {
        httpParams = httpParams.set(key, String(value));
      }
    }
    return this.http.get<ApiResponse<TRow[]>>(this.baseUrl, { params: httpParams }).pipe(
      map((res) => ({
        items: res.success && Array.isArray(res.data) ? res.data : [],
        total: res.meta?.total ?? 0,
      })),
    );
  }

  create(body: TPayload): Observable<TRow> {
    return this.http.post<ApiResponse<TRow>>(this.baseUrl, body).pipe(
      map((res) => {
        if (!res.success || !res.data) throw new Error(res.message || 'Create failed');
        return res.data;
      }),
    );
  }

  update(id: string, body: Partial<TPayload> | Record<string, unknown>): Observable<TRow> {
    return this.http.put<ApiResponse<TRow>>(`${this.baseUrl}/${id}`, body).pipe(
      map((res) => {
        if (!res.success || !res.data) throw new Error(res.message || 'Update failed');
        return res.data;
      }),
    );
  }

  delete(id: string): Observable<void> {
    return this.http.delete<ApiResponse<null>>(`${this.baseUrl}/${id}`).pipe(
      map((res) => {
        if (!res.success) throw new Error(res.message || 'Delete failed');
      }),
    );
  }

  protected existsByField(
    fieldName: string,
    value: string,
    excludeId?: string,
  ): Observable<boolean> {
    const normalized = value.trim();
    if (!normalized) return of(false);
    let params = new HttpParams().set(fieldName, normalized);
    if (excludeId) params = params.set('excludeId', excludeId);
    return this.http
      .get<ApiResponse<{ exists: boolean }>>(`${this.baseUrl}/exists`, { params })
      .pipe(map((res) => !!res.data?.exists));
  }
}
