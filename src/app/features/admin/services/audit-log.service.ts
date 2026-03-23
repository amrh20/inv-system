import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import type { ApiResponse } from '../../../core/models/api-response.model';
import { environment } from '../../../../environments/environment';
import type { AuditLogRow } from '../models/admin.models';

export interface AuditLogQuery {
  page: number;
  limit: number;
  entityType?: string;
  from?: string;
  to?: string;
  action?: string;
}

@Injectable({ providedIn: 'root' })
export class AuditLogService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/audit-log`;

  list(query: AuditLogQuery): Observable<{ logs: AuditLogRow[]; total: number }> {
    let p = new HttpParams().set('page', String(query.page)).set('limit', String(query.limit));
    if (query.entityType) p = p.set('entityType', query.entityType);
    if (query.from) p = p.set('from', query.from);
    if (query.to) p = p.set('to', query.to);
    if (query.action) p = p.set('action', query.action);
    return this.http.get<ApiResponse<AuditLogRow[]>>(this.base, { params: p }).pipe(
      map((res) => ({
        logs: res.success && Array.isArray(res.data) ? res.data : [],
        total: res.meta?.total ?? 0,
      })),
    );
  }
}
