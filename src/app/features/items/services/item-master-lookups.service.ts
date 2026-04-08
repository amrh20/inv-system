import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../../environments/environment';
import type { ApiResponse } from '../../../core/models/api-response.model';
import type {
  DepartmentOption,
  LocationOption,
  SupplierOption,
} from '../models/item.model';

@Injectable({ providedIn: 'root' })
export class ItemMasterLookupsService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

  /** Categories and subcategories are loaded via `CategoriesService` (items feature), not this service. */

  listDepartments(params?: { take?: number; isActive?: boolean }): Observable<DepartmentOption[]> {
    return this.getList<DepartmentOption>(`${this.apiUrl}/departments`, params);
  }

  listLocations(params?: { take?: number; isActive?: boolean }): Observable<LocationOption[]> {
    return this.getList<LocationOption>(`${this.apiUrl}/locations`, params);
  }

  listSuppliers(params?: { take?: number; isActive?: boolean }): Observable<SupplierOption[]> {
    return this.getList<SupplierOption>(`${this.apiUrl}/suppliers`, params);
  }

  obEligible(): Observable<{ allowed: boolean; reason?: string }> {
    return this.http
      .get<ApiResponse<{ allowed: boolean; reason?: string }>>(`${this.apiUrl}/settings/ob-eligible`)
      .pipe(map((res) => res.data ?? { allowed: false, reason: 'Unknown' }));
  }

  private getList<T>(
    url: string,
    opts?: { take?: number; isActive?: boolean },
  ): Observable<T[]> {
    let params = new HttpParams();
    if (opts?.take != null) {
      params = params.set('take', String(opts.take));
    }
    if (opts?.isActive != null) {
      params = params.set('isActive', String(opts.isActive));
    }
    return this.http.get<ApiResponse<T[]>>(url, { params }).pipe(
      map((res) => {
        if (!res.success || res.data == null) {
          return [];
        }
        return Array.isArray(res.data) ? res.data : [];
      }),
    );
  }
}
