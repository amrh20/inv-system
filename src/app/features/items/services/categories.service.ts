import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, map, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../../../environments/environment';
import type { ApiResponse } from '../../../core/models/api-response.model';
import type { CategoryOption, SubcategoryOption } from '../models/item.model';

function mapSubcategoryFromApi(raw: unknown): SubcategoryOption | null {
  const r = raw as Record<string, unknown>;
  if (r['isActive'] === false) {
    return null;
  }
  const id = r['id'];
  if (id == null || id === '') {
    return null;
  }
  return {
    id: String(id),
    name: String(r['name'] ?? ''),
  };
}

/** Maps list/detail payloads to `CategoryOption` with nested `subcategories` (supports alternate API keys). */
function normalizeCategoryOption(raw: unknown): CategoryOption {
  const r = raw as Record<string, unknown>;
  const id = String(r['id'] ?? '');
  const name = String(r['name'] ?? '');
  const subsRaw =
    r['subcategories'] ??
    r['subCategories'] ??
    r['sub_categories'] ??
    r['Subcategories'];
  const subcategories: SubcategoryOption[] = [];
  if (Array.isArray(subsRaw)) {
    for (const s of subsRaw) {
      const m = mapSubcategoryFromApi(s);
      if (m) {
        subcategories.push(m);
      }
    }
  }
  return { id, name, subcategories };
}

@Injectable({ providedIn: 'root' })
export class CategoriesService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/categories`;

  /** Active categories for dropdowns (nested subcategories normalized from common API shapes). */
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
        let rows: unknown[] = [];
        if (Array.isArray(d)) {
          rows = d;
        } else {
          const rec = d as Record<string, unknown>;
          const nested = rec['categories'] ?? rec['data'];
          rows = Array.isArray(nested) ? nested : [];
        }
        return rows.map((row) => normalizeCategoryOption(row));
      }),
    );
  }

  /**
   * Subcategories for a category (`GET /categories/:categoryId/subcategories`).
   * Returns the subcategory rows from `data` (array or nested under `data` / `subcategories`).
   */
  listSubcategories(categoryId: string): Observable<SubcategoryOption[]> {
    if (!categoryId) {
      return of([]);
    }
    return this.http.get<ApiResponse<unknown>>(`${this.base}/${categoryId}/subcategories`).pipe(
      map((res) => {
        if (!res.success || res.data == null) {
          return [];
        }
        const d = res.data as unknown;
        let rows: unknown[] = [];
        if (Array.isArray(d)) {
          rows = d;
        } else {
          const rec = d as Record<string, unknown>;
          const nested = rec['subcategories'] ?? rec['data'];
          rows = Array.isArray(nested) ? nested : [];
        }
        const out: SubcategoryOption[] = [];
        for (const row of rows) {
          const m = mapSubcategoryFromApi(row);
          if (m) {
            out.push(m);
          }
        }
        return out;
      }),
      catchError(() => of([])),
    );
  }
}
