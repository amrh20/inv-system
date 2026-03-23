import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import type { ApiResponse } from '../../../core/models/api-response.model';
import { environment } from '../../../../environments/environment';
import type { TenantRow } from '../models/tenant.model';

export interface TenantCreatePayload {
  name: string;
  slug: string;
  planType?: string;
  subStatus?: string;
  maxUsers?: number;
  licenseStartDate?: string;
  licenseEndDate?: string;
  adminEmail: string;
  adminPassword: string;
  adminFirstName?: string;
  adminLastName?: string;
}

export interface TenantUpdatePayload {
  name?: string;
  slug?: string;
  planType?: string;
  subStatus?: string;
  maxUsers?: number;
  licenseStartDate?: string;
  licenseEndDate?: string | null;
}

export interface TenantLicenseUpdatePayload {
  licenseStartDate?: string;
  licenseEndDate?: string | null;
  subStatus?: string;
  planType?: string;
  maxUsers?: number;
}

export interface TenantsListParams {
  page: number;
  limit: number;
  search?: string;
  status?: string;
}

export interface TenantsListResult {
  data: TenantRow[];
  total: number;
  page: number;
  limit: number;
}

@Injectable({ providedIn: 'root' })
export class TenantsService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/super-admin/tenants`;

  create(payload: TenantCreatePayload): Observable<TenantRow> {
    return this.http
      .post<ApiResponse<TenantRow>>(this.base, payload)
      .pipe(map((res) => res.data));
  }

  list(params: TenantsListParams): Observable<TenantsListResult> {
    let p = new HttpParams()
      .set('page', String(params.page))
      .set('limit', String(params.limit));
    if (params.search) p = p.set('search', params.search);
    if (params.status) p = p.set('status', params.status);
    return this.http.get<ApiResponse<TenantsListResult>>(this.base, { params: p }).pipe(
      map((res) => {
        const data = res.data as TenantsListResult;
        return {
          data: Array.isArray(data?.data) ? data.data : [],
          total: data?.total ?? 0,
          page: data?.page ?? 1,
          limit: data?.limit ?? 20,
        };
      }),
    );
  }

  activate(id: string): Observable<unknown> {
    return this.http.post<ApiResponse<unknown>>(`${this.base}/${id}/activate`, {});
  }

  suspend(id: string): Observable<unknown> {
    return this.http.post<ApiResponse<unknown>>(`${this.base}/${id}/suspend`, {});
  }

  forceLogout(id: string): Observable<unknown> {
    return this.http.post<ApiResponse<unknown>>(`${this.base}/${id}/force-logout`, {});
  }

  updateTenant(id: string, data: TenantUpdatePayload): Observable<TenantRow> {
    return this.http
      .patch<ApiResponse<TenantRow>>(`${this.base}/${id}`, data)
      .pipe(map((res) => res.data));
  }

  updateLicense(id: string, licenseData: TenantLicenseUpdatePayload): Observable<TenantRow> {
    return this.http
      .patch<ApiResponse<TenantRow>>(`${this.base}/${id}/license`, licenseData)
      .pipe(map((res) => res.data));
  }
}
