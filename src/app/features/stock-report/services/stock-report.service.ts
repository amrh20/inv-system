import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../../environments/environment';
import type {
  SavedStockReportDetail,
  SavedStockReportListRow,
  StockReportData,
} from '../models/stock-report.model';

@Injectable({ providedIn: 'root' })
export class StockReportService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/stock-report`;

  getReport(params: { departmentId: string; categoryId?: string; year: number }): Observable<StockReportData> {
    let p = new HttpParams().set('departmentId', params.departmentId).set('year', String(params.year));
    if (params.categoryId) p = p.set('categoryId', params.categoryId);
    return this.http.get<StockReportData>(this.base, { params: p });
  }

  exportReport(params: {
    departmentId: string;
    categoryId?: string;
    year: number;
    blindCount?: boolean;
  }): Observable<Blob> {
    let p = new HttpParams().set('departmentId', params.departmentId).set('year', String(params.year));
    if (params.categoryId) p = p.set('categoryId', params.categoryId);
    if (params.blindCount) p = p.set('blindCount', 'true');
    return this.http.get(`${this.base}/export`, { params: p, responseType: 'blob' });
  }

  uploadCount(formData: FormData): Observable<{ report?: StockReportData; updated?: number; skipped?: number; errors?: unknown[] }> {
    return this.http.post<{ report?: StockReportData; updated?: number; skipped?: number; errors?: unknown[] }>(
      `${this.base}/upload`,
      formData,
    );
  }

  saveReport(body: {
    departmentId: string;
    locationId: string;
    notes: string;
    reportData: StockReportData;
  }): Observable<unknown> {
    return this.http.post(`${this.base}/save`, body);
  }

  getSavedReports(): Observable<SavedStockReportListRow[]> {
    return this.http.get<{ data: SavedStockReportListRow[] }>(`${this.base}/saved`).pipe(map((r) => r.data ?? []));
  }

  getSavedReportById(id: string): Observable<SavedStockReportDetail> {
    return this.http.get<SavedStockReportDetail>(`${this.base}/saved/${id}`);
  }

  submitReport(id: string): Observable<unknown> {
    return this.http.post(`${this.base}/${id}/submit`, {});
  }

  approveReport(id: string): Observable<unknown> {
    return this.http.post(`${this.base}/${id}/approve`, {});
  }

  rejectReport(id: string, reason: string): Observable<unknown> {
    return this.http.post(`${this.base}/${id}/reject`, { reason });
  }

  exportPdf(id: string): Observable<Blob> {
    return this.http.get(`${this.base}/saved/${id}/pdf`, { responseType: 'blob' });
  }
}
