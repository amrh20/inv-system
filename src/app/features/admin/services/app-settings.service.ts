import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import type { ApiResponse } from '../../../core/models/api-response.model';
import { environment } from '../../../../environments/environment';
import type {
  InventoryStatusResponse,
  ObFinalizeSuccessPayload,
  OpeningBalanceSetting,
} from '../models/admin.models';

@Injectable({ providedIn: 'root' })
export class AppSettingsService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/settings`;
  private readonly inventoryBase = `${environment.apiUrl}/inventory`;

  getAllowOpeningBalance(): Observable<OpeningBalanceSetting> {
    return this.http.get<ApiResponse<OpeningBalanceSetting>>(`${this.base}/allowOpeningBalance`).pipe(
      map((res) => {
        if (!res.success) {
          throw new Error(res.message || 'Failed to load opening balance setting');
        }
        return res.data ?? { value: 'LOCKED' };
      }),
    );
  }

  /** Preferred source for settings UI: OB gate, lock metadata, post-finalize snapshot. */
  getInventoryStatus(): Observable<InventoryStatusResponse> {
    return this.http.get<ApiResponse<InventoryStatusResponse>>(`${this.base}/inventory-status`).pipe(
      map((res) => {
        if (!res.success || !res.data) {
          throw new Error(res.message || 'Failed to load inventory status');
        }
        return res.data;
      }),
    );
  }

  obFinalize(): Observable<ObFinalizeSuccessPayload> {
    return this.http.post<ApiResponse<ObFinalizeSuccessPayload>>(`${this.base}/ob-finalize`, {}).pipe(
      map((res) => {
        if (!res.success || !res.data) {
          throw new Error(res.message || 'Finalize failed');
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

  obEnable(): Observable<void> {
    return this.http.post<ApiResponse<unknown>>(`${this.base}/ob-enable`, {}).pipe(
      map((res) => {
        if (!res.success) throw new Error(res.message || 'Enable failed');
      }),
    );
  }

  /**
   * Enables the opening-balance setup phase (OPEN + persists `isOpeningBalanceAllowed` on tenant).
   * Preferred over POST /settings/ob-enable for SPA inventory contract.
   */
  patchInventoryStatus(body: {
    isOpeningBalanceAllowed: boolean;
    reason?: string;
  }): Observable<InventoryStatusResponse> {
    return this.http
      .patch<ApiResponse<InventoryStatusResponse>>(`${this.inventoryBase}/status`, body)
      .pipe(
        map((res) => {
          if (!res.success || !res.data) {
            throw new Error(res.message || 'Inventory status update failed');
          }
          return res.data;
        }),
      );
  }
}
