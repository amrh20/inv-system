import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import type { ApiResponse } from '../../../core/models/api-response.model';
import { environment } from '../../../../environments/environment';
import type { SuperAdminLogRow } from '../models/super-admin-log.model';

export interface SuperAdminLogsParams {
  page: number;
  limit: number;
  action?: string;
}

export interface SuperAdminLogsResult {
  data: SuperAdminLogRow[];
  total: number;
  page: number;
  limit: number;
}

@Injectable({ providedIn: 'root' })
export class SuperAdminLogsService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/super-admin/logs`;

  list(params: SuperAdminLogsParams): Observable<SuperAdminLogsResult> {
    let p = new HttpParams()
      .set('page', String(params.page))
      .set('limit', String(params.limit));
    if (params.action) p = p.set('action', params.action);
    return this.http.get<ApiResponse<SuperAdminLogsResult>>(this.base, { params: p }).pipe(
      map((res) => {
        const data = res.data as SuperAdminLogsResult;
        return {
          data: Array.isArray(data?.data) ? data.data : [],
          total: data?.total ?? 0,
          page: data?.page ?? 1,
          limit: data?.limit ?? 50,
        };
      }),
    );
  }
}
