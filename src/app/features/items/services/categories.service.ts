import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../../environments/environment';
import type { ApiResponse } from '../../../core/models/api-response.model';
import type { CategoryOption } from '../models/item.model';

@Injectable({ providedIn: 'root' })
export class CategoriesService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/categories`;

  /** Active categories for dropdowns (includes nested subcategories when API provides them). */
  list(options?: { take?: number; isActive?: boolean }): Observable<CategoryOption[]> {
    let params = new HttpParams();
    if (options?.take != null) {
      params = params.set('take', String(options.take));
    }
    if (options?.isActive != null) {
      params = params.set('isActive', String(options.isActive));
    }
    return this.http.get<ApiResponse<CategoryOption[]>>(this.base, { params }).pipe(
      map((res) => {
        if (!res.success || !res.data) {
          return [];
        }
        const d = res.data as unknown;
        if (Array.isArray(d)) {
          return d;
        }
        const rec = d as Record<string, unknown>;
        const nested = rec['categories'] ?? rec['data'];
        return Array.isArray(nested) ? (nested as CategoryOption[]) : [];
      }),
    );
  }
}
