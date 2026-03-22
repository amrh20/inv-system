import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../../environments/environment';
import type { ApiResponse } from '../../../core/models/api-response.model';
import type {
  LedgerEntryRow,
  LedgerListParams,
  LedgerListResult,
} from '../models/ledger-entry.model';

@Injectable({ providedIn: 'root' })
export class LedgerService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/ledger`;

  list(params: LedgerListParams): Observable<LedgerListResult> {
    let httpParams = new HttpParams();
    const entries: [string, string | number | undefined][] = [
      ['skip', params.skip],
      ['take', params.take],
      ['itemId', params.itemId],
      ['locationId', params.locationId],
      ['dateFrom', params.dateFrom],
      ['dateTo', params.dateTo],
      ['movementType', params.movementType],
      ['movementDocumentId', params.movementDocumentId],
    ];
    for (const [key, value] of entries) {
      if (value !== undefined && value !== null && value !== '') {
        httpParams = httpParams.set(key, String(value));
      }
    }
    return this.http.get<ApiResponse<LedgerEntryRow[]>>(this.base, { params: httpParams }).pipe(
      map((res) => ({
        entries: res.success && Array.isArray(res.data) ? res.data : [],
        total: res.meta?.total ?? 0,
      })),
    );
  }

  byDocument(documentId: string): Observable<LedgerEntryRow[]> {
    return this.http
      .get<ApiResponse<LedgerEntryRow[]>>(`${this.base}/by-document/${documentId}`)
      .pipe(map((res) => (res.success && Array.isArray(res.data) ? res.data : [])));
  }
}
