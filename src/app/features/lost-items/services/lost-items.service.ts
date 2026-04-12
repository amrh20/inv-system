import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../../environments/environment';
import type { ApiResponse } from '../../../core/models/api-response.model';
import type { LostItemsListRow } from '../models/lost-items.model';

@Injectable({ providedIn: 'root' })
export class LostItemsService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/lost-items`;

  list(params?: { skip?: number; take?: number; search?: string }): Observable<{ items: LostItemsListRow[]; total: number }> {
    let p = new HttpParams()
      .set('take', String(params?.take ?? 20))
      .set('skip', String(params?.skip ?? 0));
    if (params?.search) p = p.set('search', params.search);
    return this.http.get<ApiResponse<LostItemsListRow[]>>(this.base, { params: p }).pipe(
      map((res) => ({
        items: res.success && Array.isArray(res.data) ? res.data : [],
        total: res.meta?.total ?? 0,
      })),
    );
  }
}
