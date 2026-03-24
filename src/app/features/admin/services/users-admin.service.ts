import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, map, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import type { ApiResponse } from '../../../core/models/api-response.model';
import type { UserRole } from '../../../core/models/enums';
import { environment } from '../../../../environments/environment';
import type {
  ExistingUserSearchHit,
  UserCreatePayload,
  UserListRow,
} from '../models/admin.models';

export interface UsersListResult {
  users: UserListRow[];
  total: number;
  maxUsers: number | null;
  totalActiveUsers: number;
}

@Injectable({ providedIn: 'root' })
export class UsersAdminService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/users`;

  list(params: {
    page: number;
    limit: number;
    search?: string;
    role?: UserRole | '';
  }): Observable<UsersListResult> {
    let p = new HttpParams()
      .set('page', String(params.page))
      .set('limit', String(params.limit));
    if (params.search) p = p.set('search', params.search);
    if (params.role) p = p.set('role', params.role);
    return this.http.get<ApiResponse<unknown>>(this.base, { params: p }).pipe(
      map((res) => {
        const meta = (res.meta ?? {}) as Record<string, unknown>;
        const metaTotal = typeof meta['total'] === 'number' ? meta['total'] : undefined;
        const metaMaxUsers = typeof meta['maxUsers'] === 'number' ? meta['maxUsers'] : null;
        const metaActiveUsers =
          typeof meta['totalActiveUsers'] === 'number' ? meta['totalActiveUsers'] : undefined;

        let users: UserListRow[] = [];
        let total = metaTotal ?? 0;
        let maxUsers: number | null = metaMaxUsers;
        let totalActiveUsers = metaActiveUsers ?? 0;

        if (Array.isArray(res.data)) {
          users = res.success ? (res.data as UserListRow[]) : [];
          if (metaTotal == null) {
            total = users.length;
          }
          if (metaActiveUsers == null) {
            totalActiveUsers = users.filter((user) => user.isActive).length;
          }
        } else if (res.data && typeof res.data === 'object') {
          const payload = res.data as Record<string, unknown>;
          users = Array.isArray(payload['users']) ? (payload['users'] as UserListRow[]) : [];
          total =
            typeof payload['total'] === 'number'
              ? payload['total']
              : metaTotal ?? users.length;
          if (typeof payload['maxUsers'] === 'number') {
            maxUsers = payload['maxUsers'];
          }
          const payloadActiveUsers =
            payload['totalActiveUsers'] ?? payload['activeUsers'] ?? payload['usedSlots'] ?? payload['count'];
          if (typeof payloadActiveUsers === 'number') {
            totalActiveUsers = payloadActiveUsers;
          } else if (metaActiveUsers == null) {
            totalActiveUsers = users.filter((user) => user.isActive).length;
          }
        }

        return { users, total, maxUsers, totalActiveUsers };
      }),
    );
  }

  /**
   * Search users that exist in other tenants (min 3 chars on the client before calling).
   * `GET /users/search-existing?email=...`
   */
  searchExistingByEmail(email: string): Observable<ExistingUserSearchHit[]> {
    const trimmed = email.trim();
    if (trimmed.length < 3) {
      return of([]);
    }
    const params = new HttpParams().set('email', trimmed);
    return this.http
      .get<ApiResponse<unknown>>(`${this.base}/search-existing`, { params })
      .pipe(
        map((res) => {
          if (!res.success || res.data == null) {
            return [];
          }
          const data = res.data;
          if (Array.isArray(data)) {
            return data as ExistingUserSearchHit[];
          }
          if (typeof data === 'object' && Array.isArray((data as Record<string, unknown>)['users'])) {
            return (data as { users: ExistingUserSearchHit[] }).users;
          }
          return [];
        }),
        catchError(() => of([])),
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
