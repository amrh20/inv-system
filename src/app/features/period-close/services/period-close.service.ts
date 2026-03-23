import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import type { PeriodCloseRow } from '../models/period-close.model';

@Injectable({ providedIn: 'root' })
export class PeriodCloseService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/period-close`;

  list(): Observable<PeriodCloseRow[]> {
    return this.http.get<PeriodCloseRow[]>(this.base);
  }

  close(body: { year: number; month?: number | null; notes?: string }): Observable<unknown> {
    return this.http.post(`${this.base}/close`, body);
  }

  reopen(id: string): Observable<unknown> {
    return this.http.post(`${this.base}/${id}/reopen`, {});
  }
}
