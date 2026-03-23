import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import type { ApiResponse } from '../../../core/models/api-response.model';
import { environment } from '../../../../environments/environment';
import type { OpeningBalanceSetting } from '../models/admin.models';

@Injectable({ providedIn: 'root' })
export class AppSettingsService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/settings`;

  getAllowOpeningBalance(): Observable<OpeningBalanceSetting> {
    return this.http.get<ApiResponse<OpeningBalanceSetting>>(`${this.base}/allowOpeningBalance`).pipe(
      map((res) => {
        if (!res.success || res.data == null) {
          return { value: null };
        }
        return res.data;
      }),
    );
  }

  obLock(reason: string): Observable<void> {
    return this.http.post<ApiResponse<unknown>>(`${this.base}/ob-lock`, { reason }).pipe(
      map((res) => {
        if (!res.success) throw new Error(res.message || 'Lock failed');
      }),
    );
  }

  obEnable(reason: string): Observable<void> {
    return this.http.post<ApiResponse<unknown>>(`${this.base}/ob-enable`, { reason }).pipe(
      map((res) => {
        if (!res.success) throw new Error(res.message || 'Enable failed');
      }),
    );
  }
}
