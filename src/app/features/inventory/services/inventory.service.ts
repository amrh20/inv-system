import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../../environments/environment';
import type { ApiResponse } from '../../../core/models/api-response.model';
import type { ItemListRow } from '../../items/models/item.model';

export interface ItemsByLocationParams {
  search?: string;
  take?: number;
}

export interface ItemByLocationSelectRow {
  id: string;
  name: string;
  code?: string | null;
  barcode?: string | null;
  currentStock?: number;
}

@Injectable({ providedIn: 'root' })
export class InventoryService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/inventory`;

  /**
   * Items allowed or in stock at the given warehouse (location), for GRN line picking.
   */
  getItemsByLocation(locationId: string, params?: ItemsByLocationParams): Observable<ItemListRow[]> {
    let httpParams = new HttpParams();
    if (params?.search != null && params.search !== '') {
      httpParams = httpParams.set('search', params.search);
    }
    if (params?.take != null && params.take > 0) {
      httpParams = httpParams.set('take', String(params.take));
    }
    return this.http
      .get<ApiResponse<ItemListRow[]>>(`${this.base}/items-by-locations/${encodeURIComponent(locationId)}`, {
        params: httpParams,
      })
      .pipe(
        map((res) => {
          if (!res.success || !res.data) {
            throw new Error(res.message || 'Failed to load items for location');
          }
          return Array.isArray(res.data) ? res.data : [];
        }),
      );
  }

  getItemsByLocationSelect(
    locationId: string,
    params?: Pick<ItemsByLocationParams, 'search'>,
  ): Observable<ItemByLocationSelectRow[]> {
    let httpParams = new HttpParams();
    if (params?.search != null && params.search !== '') {
      httpParams = httpParams.set('search', params.search);
    }
    return this.http
      .get<ApiResponse<ItemByLocationSelectRow[]>>(
        `${this.base}/items-by-locations/${encodeURIComponent(locationId)}/select`,
        {
          params: httpParams,
        },
      )
      .pipe(
        map((res) => {
          if (!res.success || !res.data) {
            throw new Error(res.message || 'Failed to load item options for location');
          }
          return Array.isArray(res.data) ? res.data : [];
        }),
      );
  }
}
