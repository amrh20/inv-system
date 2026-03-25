import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import type { ApiResponse } from '../../../core/models/api-response.model';
import { environment } from '../../../../environments/environment';
import type { TenantRow } from '../models/tenant.model';

/** Nested admin for tenant create (e.g. wizard step 2 first hotel). */
export interface TenantCreateAdminUserPayload {
  email: string;
  firstName?: string;
  lastName?: string;
  password?: string;
  phone?: string;
}

/** POST /super-admin/tenants/full-organization — one-shot org + initial hotel. */
export interface CreateFullOrganizationPayload {
  organization: {
    name: string;
    slug: string;
    maxBranches: number;
  };
  adminUser: {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
    phone: string;
  };
  hotel: {
    name: string;
    slug: string;
    planType: string;
    subStatus: string;
    licenseStartDate?: string;
    licenseEndDate?: string | null;
    maxUsers?: number;
    /** When hotel admin differs from the organization manager. */
    adminUser?: TenantCreateAdminUserPayload;
  };
}

export interface TenantCreatePayload {
  name: string;
  slug: string;
  planType?: string;
  subStatus?: string;
  maxUsers?: number;
  parentId?: string | null;
  hasBranches?: boolean;
  maxBranches?: number;
  licenseStartDate?: string;
  licenseEndDate?: string | null;
  /** Preferred for child / wizard step 2 when backend expects a single admin object. */
  adminUser?: TenantCreateAdminUserPayload;
  /** Omitted for child tenants when managers are inherited from the parent org. */
  adminEmail?: string;
  /** Required when creating a new user; omit when `existingUserId` is sent. */
  adminPassword?: string;
  /** When set, links an existing platform user instead of creating credentials. */
  existingUserId?: string;
  /** Branch only: whether org-level managers are also assigned to the new branch. */
  assignOrgManagersToBranch?: boolean;
  adminFirstName?: string;
  adminLastName?: string;
  /** Initial manager phone (root org create) when supported by API. */
  adminPhone?: string;
}

export interface TenantUpdatePayload {
  name?: string;
  slug?: string;
  planType?: string;
  subStatus?: string;
  maxUsers?: number;
  parentId?: string | null;
  hasBranches?: boolean;
  maxBranches?: number;
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
  adminStatus?: 'ACTIVE' | 'SUSPENDED';
  subStatus?: 'TRIAL' | 'EXPIRED';
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
  private readonly adminBase = `${environment.apiUrl}/admin/tenants`;

  create(payload: TenantCreatePayload): Observable<TenantRow> {
    return this.http
      .post<ApiResponse<TenantRow>>(this.base, payload)
      .pipe(map((res) => res.data));
  }

  /** Creates organization, org manager, and first hotel in one request. */
  createFullOrganization(payload: CreateFullOrganizationPayload): Observable<TenantRow> {
    return this.http
      .post<ApiResponse<TenantRow>>(`${this.base}/full-organization`, payload)
      .pipe(map((res) => res.data));
  }

  /** Single tenant (e.g. org manager email for “add hotel under org”). */
  getById(id: string): Observable<TenantRow> {
    return this.http.get<ApiResponse<TenantRow>>(`${this.base}/${id}`).pipe(map((res) => res.data));
  }

  list(params: TenantsListParams): Observable<TenantsListResult> {
    let p = new HttpParams()
      .set('page', String(params.page))
      .set('limit', String(params.limit));
    if (params.search) p = p.set('search', params.search);
    if (params.status) p = p.set('status', params.status);
    if (params.adminStatus) p = p.set('adminStatus', params.adminStatus);
    if (params.subStatus) p = p.set('subStatus', params.subStatus);
    return this.http
      .get<ApiResponse<TenantsListResult | TenantRow[]>>(this.base, { params: p })
      .pipe(
        map((res) => {
          const payload = res.data as TenantsListResult | TenantRow[] | null | undefined;
          const data = Array.isArray(payload)
            ? payload
            : Array.isArray(payload?.data)
              ? payload.data
              : [];

          const total =
            (Array.isArray(payload) ? payload.length : payload?.total) ??
            res.meta?.total ??
            data.length;
          const page = (Array.isArray(payload) ? params.page : payload?.page) ?? res.meta?.page ?? 1;
          const limit =
            (Array.isArray(payload) ? params.limit : payload?.limit) ?? res.meta?.limit ?? params.limit;

          return { data, total, page, limit };
        })
      );
  }

  activate(id: string): Observable<TenantRow> {
    return this.http
      .post<ApiResponse<TenantRow>>(`${this.base}/${id}/activate`, {})
      .pipe(map((res) => res.data));
  }

  suspend(id: string): Observable<unknown> {
    return this.http.post<ApiResponse<unknown>>(`${this.base}/${id}/suspend`, {});
  }

  suspendOrganization(id: string): Observable<unknown> {
    return this.http.patch<ApiResponse<unknown>>(`${this.adminBase}/${id}/suspend`, {});
  }

  forceLogout(id: string): Observable<unknown> {
    return this.http.post<ApiResponse<unknown>>(`${this.base}/${id}/force-logout`, {});
  }

  updateTenant(id: string, data: TenantUpdatePayload): Observable<TenantRow> {
    return this.http
      .put<ApiResponse<TenantRow>>(`${this.base}/${id}`, data)
      .pipe(map((res) => res.data));
  }

  updateLicense(id: string, licenseData: TenantLicenseUpdatePayload): Observable<TenantRow> {
    return this.http
      .patch<ApiResponse<TenantRow>>(`${this.base}/${id}/license`, licenseData)
      .pipe(map((res) => res.data));
  }
}
