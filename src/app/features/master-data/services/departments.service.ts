import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import type { ApiResponse } from '../../../core/models/api-response.model';
import { environment } from '../../../../environments/environment';
import type { DepartmentPayload, DepartmentRow } from '../models/department.model';
import { BaseCrudService } from '../shared/base-crud.service';

class DepartmentsCrudService extends BaseCrudService<DepartmentRow, DepartmentPayload> {}

@Injectable({ providedIn: 'root' })
export class DepartmentsService {
  private readonly httpClient = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/departments`;
  private readonly baseCrud = new DepartmentsCrudService(this.httpClient, this.base);

  list(params?: {
    search?: string;
    skip?: number;
    take?: number;
    isActive?: boolean;
    /** Lighter payload when supported by the API */
    slim?: boolean;
  }): Observable<{ departments: DepartmentRow[]; total: number }> {
    return this.baseCrud.list(params).pipe(map((res) => ({ departments: res.items, total: res.total })));
  }

  create(body: DepartmentPayload): Observable<DepartmentRow> {
    return this.baseCrud.create(body);
  }

  update(id: string, body: DepartmentPayload): Observable<DepartmentRow> {
    return this.baseCrud.update(id, body);
  }

  delete(id: string): Observable<void> {
    return this.baseCrud.delete(id);
  }

  /** Backend flips `isActive` — no body required. */
  toggleActive(id: string): Observable<DepartmentRow> {
    return this.httpClient
      .patch<ApiResponse<DepartmentRow>>(`${this.base}/${id}/toggle`, {})
      .pipe(
        map((res) => {
          if (!res.success || !res.data) throw new Error(res.message || 'Toggle failed');
          return res.data;
        }),
      );
  }

  codeExists(code: string, excludeId?: string): Observable<boolean> {
    let p = new HttpParams().set('code', code.trim());
    if (excludeId) p = p.set('excludeId', excludeId);
    return this.httpClient
      .get<{ success: boolean; data?: { exists?: boolean } }>(`${this.base}/exists`, { params: p })
      .pipe(map((res) => !!res.data?.exists));
  }
}
