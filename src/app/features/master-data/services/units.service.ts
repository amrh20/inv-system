import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../../environments/environment';
import type { UnitPayload, UnitRow } from '../models/unit.model';
import { BaseCrudService } from '../shared/base-crud.service';

class UnitsCrudService extends BaseCrudService<UnitRow, UnitPayload> {}

@Injectable({ providedIn: 'root' })
export class UnitsService {
  private readonly httpClient = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/units`;
  private readonly baseCrud = new UnitsCrudService(this.httpClient, this.base);

  list(params?: {
    search?: string;
    skip?: number;
    take?: number;
    isActive?: boolean;
  }): Observable<{ units: UnitRow[]; total: number }> {
    return this.baseCrud.list(params).pipe(map((res) => ({ units: res.items, total: res.total })));
  }

  create(body: UnitPayload): Observable<UnitRow> {
    return this.baseCrud.create(body);
  }

  update(id: string, body: UnitPayload): Observable<UnitRow> {
    return this.baseCrud.update(id, body);
  }

  abbreviationExists(abbreviation: string, excludeId?: string): Observable<boolean> {
    let p = new HttpParams().set('abbreviation', abbreviation.trim());
    if (excludeId) p = p.set('excludeId', excludeId);
    return this.httpClient
      .get<{ success: boolean; data?: { exists?: boolean } }>(`${this.base}/exists`, { params: p })
      .pipe(map((res) => !!res.data?.exists));
  }
}
