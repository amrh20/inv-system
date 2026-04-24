import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, catchError, map, of } from 'rxjs';
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
  RequirementsResponse,
} from '../models/item.model';

@Injectable({ providedIn: 'root' })
export class ItemsService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/items`;
  private readonly filesBase = `${environment.apiUrl}/files`;

  /**
   * Paginated list — mirrors React `itemsAPI.list`.
   * Delegates to {@link getItems}; use either name per call-site preference.
   */
  list(params: ItemsListParams): Observable<ItemsListResult> {
    return this.getItems(params);
  }

  /** Prerequisites for creating/importing items (`GET /items/check-requirements`). */
  checkRequirements(): Observable<ApiResponse<RequirementsResponse>> {
    return this.http.get<ApiResponse<RequirementsResponse>>(`${this.base}/check-requirements`);
  }

  getItems(params: ItemsListParams): Observable<ItemsListResult> {
    let httpParams = new HttpParams();
    const entries: [string, string | number | boolean | undefined][] = [
      ['skip', params.skip],
      ['take', params.take],
      ['search', params.search],
      ['categoryId', params.categoryId],
      ['departmentId', params.departmentId],
      ['locationId', params.locationId],
      ['catalog', params.catalog === true ? 'true' : undefined],
      ['slim', params.slim === true ? 'true' : undefined],
      ['isActive', params.isActive],
    ];
    for (const [key, value] of entries) {
      if (value !== undefined && value !== null && value !== '') {
        httpParams = httpParams.set(key, String(value));
      }
    }
    return this.http.get<ApiResponse<ItemListRow[] | ItemListRow>>(this.base, { params: httpParams }).pipe(
      map((res) => {
        const raw = res.success ? res.data : null;
        const items = Array.isArray(raw)
          ? raw
          : raw != null && typeof raw === 'object'
            ? [raw as ItemListRow]
            : [];
        /** `slim=true` omits `meta`; use row count as total when unpaginated. */
        return {
          items,
          total: res.meta?.total ?? items.length,
        };
      }),
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

  updateItem(id: string, body: Partial<ItemPayload>): Observable<ItemDetail> {
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
  importItems(payload: {
    filePath: string;
    asOpeningBalance?: boolean;
    openingBalanceReason?: string;
  }): Observable<ItemImportResult> {
    return this.http
      .post<ApiResponse<ItemImportResult>>(`${this.base}/import/confirm`, payload)
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
  importPreview(
    file: File,
    options: { asOpeningBalance: boolean },
  ): Observable<ItemImportPreviewResponse['data']> {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('asOpeningBalance', options.asOpeningBalance ? 'true' : 'false');
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

  getSignedUrl(
    key: string,
    ttl?: number,
  ): Observable<{ url: string; expiresAt?: string }> {
    let params = new HttpParams().set('key', key);
    if (ttl != null && Number.isFinite(ttl) && ttl > 0) {
      params = params.set('ttl', String(ttl));
    }
    return this.http
      .get<ApiResponse<{ url: string; expiresAt?: string }>>(`${this.filesBase}/signed-url`, { params })
      .pipe(
        map((res) => {
          if (!res.success || !res.data?.url) {
            throw new Error(res.message || 'Failed to resolve image URL');
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
    const isActiveParam =
      query.isActive !== undefined && query.isActive !== null && query.isActive !== ''
        ? String(query.isActive)
        : undefined;
    const entries: [string, string | undefined][] = [
      ['search', query.search],
      ['categoryId', query.categoryId],
      ['departmentId', query.departmentId],
      ['locationId', query.locationId],
      ['isActive', isActiveParam],
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

  /**
   * Returns a browser-usable image URL:
   * - absolute URL => returned as-is
   * - `/uploads/...` => API host prefixed
   * - `tenants/...` key => resolved through `GET /files/signed-url`
   */
  resolveDisplayUrl$(pathOrUrl: string | null | undefined): Observable<string | null> {
    if (!pathOrUrl) {
      return of(null);
    }
    if (pathOrUrl.startsWith('http://') || pathOrUrl.startsWith('https://')) {
      return of(pathOrUrl);
    }
    if (pathOrUrl.startsWith('/uploads/')) {
      return of(this.resolveAssetUrl(pathOrUrl));
    }
    if (pathOrUrl.startsWith('tenants/')) {
      return this.getSignedUrl(pathOrUrl).pipe(
        map((res) => res.url),
        catchError(() => of(null)),
      );
    }
    return of(this.resolveAssetUrl(pathOrUrl));
  }
}
