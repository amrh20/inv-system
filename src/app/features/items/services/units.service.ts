import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../../environments/environment';
import type { ApiResponse } from '../../../core/models/api-response.model';
import type { UnitOption } from '../models/item.model';

@Injectable({ providedIn: 'root' })
export class UnitsService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/units`;

  list(options?: { take?: number; isActive?: boolean }): Observable<UnitOption[]> {
    let params = new HttpParams();
    if (options?.take != null) {
      params = params.set('take', String(options.take));
    }
    if (options?.isActive != null) {
      params = params.set('isActive', String(options.isActive));
    }
    return this.http.get<ApiResponse<UnitOption[]>>(this.base, { params }).pipe(
      map((res) => {
        if (!res.success || !res.data) {
          return [];
        }
        const d = res.data as unknown;
        if (Array.isArray(d)) {
          return d;
        }
        const rec = d as Record<string, unknown>;
        const nested = rec['units'] ?? rec['data'];
        return Array.isArray(nested) ? (nested as UnitOption[]) : [];
      }),
    );
  }
}
