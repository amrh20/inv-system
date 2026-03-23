import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import type { ApiResponse } from '../../../core/models/api-response.model';
import type { UserRole } from '../../../core/models/enums';
import { environment } from '../../../../environments/environment';
import type { UserCreatePayload, UserListRow } from '../models/admin.models';

@Injectable({ providedIn: 'root' })
export class UsersAdminService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/users`;

  list(params: {
    page: number;
    limit: number;
    search?: string;
    role?: UserRole | '';
  }): Observable<{ users: UserListRow[]; total: number }> {
    let p = new HttpParams()
      .set('page', String(params.page))
      .set('limit', String(params.limit));
    if (params.search) p = p.set('search', params.search);
    if (params.role) p = p.set('role', params.role);
    return this.http.get<ApiResponse<UserListRow[]>>(this.base, { params: p }).pipe(
      map((res) => ({
        users: res.success && Array.isArray(res.data) ? res.data : [],
        total: res.meta?.total ?? 0,
      })),
    );
  }

  create(body: UserCreatePayload): Observable<UserListRow> {
    return this.http.post<ApiResponse<UserListRow>>(this.base, body).pipe(
      map((res) => {
        if (!res.success || !res.data) throw new Error(res.message || 'Create failed');
        return res.data;
      }),
    );
  }

  update(id: string, body: UserCreatePayload): Observable<UserListRow> {
    return this.http.put<ApiResponse<UserListRow>>(`${this.base}/${id}`, body).pipe(
      map((res) => {
        if (!res.success || !res.data) throw new Error(res.message || 'Update failed');
        return res.data;
      }),
    );
  }

  /** Partial update (profile, password-only, etc.) — matches backend `PUT /users/:id`. */
  putUser(id: string, body: Record<string, unknown>): Observable<UserListRow> {
    return this.http.put<ApiResponse<UserListRow>>(`${this.base}/${id}`, body).pipe(
      map((res) => {
        if (!res.success || !res.data) throw new Error(res.message || 'Update failed');
        return res.data;
      }),
    );
  }
}
