import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../../environments/environment';
import type { ApiResponse } from '../../../core/models/api-response.model';
import type {
  LowStockItem,
  ParLevelRow,
  ParLevelUpdate,
} from '../models/par-level.model';

@Injectable({ providedIn: 'root' })
export class ParLevelService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/par-levels`;

  getParLevels(locationId: string, categoryId?: string): Observable<ParLevelRow[]> {
    let params = new HttpParams().set('locationId', locationId);
    if (categoryId) {
      params = params.set('categoryId', categoryId);
    }
    return this.http.get<ParLevelRow[] | ApiResponse<ParLevelRow[]>>(this.base, { params }).pipe(
      map((res) => {
        if (Array.isArray(res)) return res;
        const data = (res as ApiResponse<ParLevelRow[]>).data;
        return data != null && Array.isArray(data) ? data : [];
      }),
    );
  }

  updateParLevels(updates: ParLevelUpdate[]): Observable<{ updated: number }> {
    return this.http
      .put<{ updated: number } | ApiResponse<{ updated: number }>>(this.base, {
        updates,
      })
      .pipe(
        map((res) => {
          if (typeof (res as { updated?: number }).updated === 'number') {
            return res as { updated: number };
          }
          const data = (res as ApiResponse<{ updated: number }>).data;
          return data ?? { updated: 0 };
        }),
      );
  }

  getLowStock(locationId?: string): Observable<LowStockItem[]> {
    let params = new HttpParams();
    if (locationId) {
      params = params.set('locationId', locationId);
    }
    return this.http
      .get<{ count: number; items: LowStockItem[] } | ApiResponse<{ count: number; items: LowStockItem[] }>>(
        `${this.base}/low-stock`,
        { params },
      )
      .pipe(
        map((res) => {
          if (typeof (res as { items?: unknown[] }).items === 'object') {
            return (res as { items: LowStockItem[] }).items ?? [];
          }
          const data = (res as ApiResponse<{ count: number; items: LowStockItem[] }>).data;
          return data?.items ?? [];
        }),
      );
  }
}
