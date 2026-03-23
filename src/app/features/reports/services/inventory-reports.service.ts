import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../../environments/environment';
import type { ApiResponse } from '../../../core/models/api-response.model';
import type {
  EngineReportType,
  GeneratedReport,
  SummaryInventoryPayload,
  ValuationPayload,
} from '../models/report.models';

@Injectable({ providedIn: 'root' })
export class InventoryReportsService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/reports`;

  getSummaryInventory(params: {
    startDate: string;
    endDate: string;
    departmentIds?: string;
    categoryId?: string;
  }): Observable<SummaryInventoryPayload> {
    let p = new HttpParams()
      .set('startDate', params.startDate)
      .set('endDate', params.endDate);
    if (params.departmentIds) p = p.set('departmentIds', params.departmentIds);
    if (params.categoryId) p = p.set('categoryId', params.categoryId);
    return this.http.get<ApiResponse<SummaryInventoryPayload>>(`${this.base}/summary-inventory`, { params: p }).pipe(
      map((res) => {
        if (!res.success || !res.data) {
          throw new Error(res.message || 'Summary report failed');
        }
        return res.data;
      }),
    );
  }

  generate(body: {
    reportType: EngineReportType;
    departmentIds: string[];
    startDate: string;
    endDate: string;
    categoryId?: string;
  }): Observable<GeneratedReport> {
    return this.http.post<ApiResponse<GeneratedReport>>(`${this.base}/generate`, body).pipe(
      map((res) => {
        if (!res.success || !res.data) {
          throw new Error(res.message || 'Generate failed');
        }
        return res.data;
      }),
    );
  }

  getById(id: string): Observable<GeneratedReport> {
    return this.http.get<ApiResponse<GeneratedReport>>(`${this.base}/${id}`).pipe(
      map((res) => {
        if (!res.success || !res.data) {
          throw new Error(res.message || 'Report not found');
        }
        return res.data;
      }),
    );
  }

  exportExcel(id: string): Observable<Blob> {
    return this.http.get(`${this.base}/${id}/excel`, {
      responseType: 'blob',
    });
  }

  exportPdf(id: string): Observable<Blob> {
    return this.http.get(`${this.base}/${id}/pdf`, {
      responseType: 'blob',
    });
  }

  getValuation(params: {
    asOfDate: string;
    departmentIds?: string;
    locationIds?: string;
    categoryId?: string;
  }): Observable<ValuationPayload> {
    let p = new HttpParams().set('asOfDate', params.asOfDate);
    if (params.departmentIds) p = p.set('departmentIds', params.departmentIds);
    if (params.locationIds) p = p.set('locationIds', params.locationIds);
    if (params.categoryId) p = p.set('categoryId', params.categoryId);
    return this.http.get<ApiResponse<ValuationPayload>>(`${this.base}/valuation`, { params: p }).pipe(
      map((res) => {
        if (!res.success || !res.data) {
          throw new Error(res.message || 'Valuation failed');
        }
        return res.data;
      }),
    );
  }

  downloadValuationExcel(params: {
    asOfDate: string;
    departmentIds?: string;
    locationIds?: string;
    categoryId?: string;
  }): Observable<Blob> {
    let p = new HttpParams().set('asOfDate', params.asOfDate).set('format', 'excel');
    if (params.departmentIds) p = p.set('departmentIds', params.departmentIds);
    if (params.locationIds) p = p.set('locationIds', params.locationIds);
    if (params.categoryId) p = p.set('categoryId', params.categoryId);
    return this.http.get(`${this.base}/valuation/excel`, { params: p, responseType: 'blob' });
  }
}
