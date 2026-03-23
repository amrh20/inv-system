import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../../environments/environment';
import type { ApiResponse } from '../../../core/models/api-response.model';
import type {
  ItemDetail,
  ItemImportResult,
  ItemImportPreviewResponse,
  ItemListRow,
  ItemPayload,
  ItemsListParams,
  ItemsListResult,
  ItemUnitRow,
} from '../models/item.model';

@Injectable({ providedIn: 'root' })
export class ItemsService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/items`;

  /**
   * Paginated list — mirrors React `itemsAPI.list`.
   * Delegates to {@link getItems}; use either name per call-site preference.
   */
  list(params: ItemsListParams): Observable<ItemsListResult> {
    return this.getItems(params);
  }

  getItems(params: ItemsListParams): Observable<ItemsListResult> {
    let httpParams = new HttpParams();
    const entries: [string, string | number | undefined][] = [
      ['skip', params.skip],
      ['take', params.take],
      ['search', params.search],
      ['categoryId', params.categoryId],
      ['departmentId', params.departmentId],
      ['locationId', params.locationId],
      ['isActive', params.isActive],
    ];
    for (const [key, value] of entries) {
      if (value !== undefined && value !== null && value !== '') {
        httpParams = httpParams.set(key, String(value));
      }
    }
    return this.http
      .get<ApiResponse<ItemListRow[]>>(this.base, { params: httpParams })
      .pipe(
        map((res) => ({
          items: res.success && Array.isArray(res.data) ? res.data : [],
          total: res.meta?.total ?? 0,
        })),
      );
  }

  /** Same as React `itemsAPI.getById`. */
  getItemById(id: string): Observable<ItemDetail> {
    return this.http.get<ApiResponse<ItemDetail>>(`${this.base}/${id}`).pipe(
      map((res) => {
        if (!res.success || !res.data) {
          throw new Error(res.message || 'Item not found');
        }
        return res.data;
      }),
    );
  }

  createItem(body: ItemPayload): Observable<ItemDetail> {
    return this.http.post<ApiResponse<ItemDetail>>(this.base, body).pipe(
      map((res) => {
        if (!res.success || !res.data) {
          throw new Error(res.message || 'Create failed');
        }
        return res.data;
      }),
    );
  }

  updateItem(id: string, body: ItemPayload): Observable<ItemDetail> {
    return this.http.put<ApiResponse<ItemDetail>>(`${this.base}/${id}`, body).pipe(
      map((res) => {
        if (!res.success || !res.data) {
          throw new Error(res.message || 'Update failed');
        }
        return res.data;
      }),
    );
  }

  deleteItem(id: string): Observable<void> {
    return this.http.delete<ApiResponse<null>>(`${this.base}/${id}`).pipe(
      map((res) => {
        if (!res.success) {
          throw new Error(res.message || 'Delete failed');
        }
      }),
    );
  }

  /**
   * Excel import — confirm step (`POST /items/import/confirm`).
   * Alias name matches legacy `importItems` usage from the React client.
   */
  importItems(
    rows: unknown[],
    filePath: string,
    asOpeningBalance = false,
  ): Observable<ItemImportResult> {
    return this.http
      .post<ApiResponse<ItemImportResult>>(`${this.base}/import/confirm`, {
        rows,
        filePath,
        asOpeningBalance,
      })
      .pipe(
        map((res) => {
          if (!res.success) {
            throw new Error(res.message || 'Import failed');
          }
          return (
            res.data ?? {
              inserted: 0,
              updated: 0,
              failed: 0,
              obCount: 0,
              obDocuments: [],
              failures: [],
            }
          );
        }),
      );
  }

  /** Parse uploaded spreadsheet (`POST /items/import/preview`). */
  importPreview(file: File): Observable<ItemImportPreviewResponse['data']> {
    const fd = new FormData();
    fd.append('file', file);
    return this.http.post<ItemImportPreviewResponse>(`${this.base}/import/preview`, fd).pipe(
      map((res) => {
        if (!res.success || !res.data) {
          throw new Error(res.message || 'Preview failed');
        }
        return res.data;
      }),
    );
  }

  toggleActive(id: string): Observable<ItemDetail> {
    return this.http.patch<ApiResponse<ItemDetail>>(`${this.base}/${id}/toggle-active`, {}).pipe(
      map((res) => {
        if (!res.success || !res.data) {
          throw new Error(res.message || 'Toggle failed');
        }
        return res.data;
      }),
    );
  }

  getItemUnits(id: string): Observable<ItemUnitRow[]> {
    return this.http.get<ApiResponse<ItemUnitRow[]>>(`${this.base}/${id}/units`).pipe(
      map((res) => (res.success && Array.isArray(res.data) ? res.data : [])),
    );
  }

  uploadImage(id: string, file: File): Observable<ItemDetail> {
    const fd = new FormData();
    fd.append('image', file);
    return this.http.post<ApiResponse<ItemDetail>>(`${this.base}/${id}/image`, fd).pipe(
      map((res) => {
        if (!res.success || !res.data) {
          throw new Error(res.message || 'Image upload failed');
        }
        return res.data;
      }),
    );
  }

  downloadTemplate(): Observable<Blob> {
    return this.http.get(`${this.base}/import/template`, {
      responseType: 'blob',
    });
  }

  exportItems(query: Omit<ItemsListParams, 'skip' | 'take'>): Observable<Blob> {
    let httpParams = new HttpParams();
    const entries: [string, string | undefined][] = [
      ['search', query.search],
      ['categoryId', query.categoryId],
      ['departmentId', query.departmentId],
      ['locationId', query.locationId],
      ['isActive', query.isActive],
    ];
    for (const [key, value] of entries) {
      if (value !== undefined && value !== null && value !== '') {
        httpParams = httpParams.set(key, value);
      }
    }
    return this.http.get(`${this.base}/export`, {
      params: httpParams,
      responseType: 'blob',
    });
  }

  /** Absolute URL for item images when API returns `/uploads/...` paths. */
  resolveAssetUrl(pathOrUrl: string | null | undefined): string | null {
    if (!pathOrUrl) {
      return null;
    }
    if (pathOrUrl.startsWith('http://') || pathOrUrl.startsWith('https://')) {
      return pathOrUrl;
    }
    const root = environment.apiUrl.replace(/\/api\/?$/, '');
    const p = pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`;
    return `${root}${p}`;
  }
}
