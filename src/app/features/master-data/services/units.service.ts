import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../../environments/environment';
import type { ApiResponse } from '../../../core/models/api-response.model';
import type { UnitPayload, UnitRow } from '../models/unit.model';

@Injectable({ providedIn: 'root' })
export class UnitsService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/units`;

  list(params?: {
    search?: string;
    skip?: number;
    take?: number;
    isActive?: boolean;
  }): Observable<{ units: UnitRow[]; total: number }> {
    let p = new HttpParams();
    if (params?.search) p = p.set('search', params.search);
    if (params?.skip != null) p = p.set('skip', String(params.skip));
    if (params?.take != null) p = p.set('take', String(params.take));
    if (params?.isActive != null) p = p.set('isActive', String(params.isActive));
    return this.http.get<ApiResponse<UnitRow[]>>(this.base, { params: p }).pipe(
      map((res) => {
        const data = res.data as unknown;
        const rec = data as Record<string, unknown>;
        const arr: UnitRow[] = Array.isArray(data)
          ? (data as UnitRow[])
          : Array.isArray(rec['units'])
            ? (rec['units'] as UnitRow[])
            : Array.isArray(rec['data'])
              ? (rec['data'] as UnitRow[])
              : [];
        return {
          units: res.success ? arr : [],
          total: res.meta?.total ?? arr.length,
        };
      }),
    );
  }

  create(body: UnitPayload): Observable<UnitRow> {
    return this.http.post<ApiResponse<UnitRow>>(this.base, body).pipe(
      map((res) => {
        if (!res.success || !res.data) throw new Error(res.message || 'Create failed');
        return res.data;
      }),
    );
  }

  update(id: string, body: UnitPayload): Observable<UnitRow> {
    return this.http.put<ApiResponse<UnitRow>>(`${this.base}/${id}`, body).pipe(
      map((res) => {
        if (!res.success || !res.data) throw new Error(res.message || 'Update failed');
        return res.data;
      }),
    );
  }
}
