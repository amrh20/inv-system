import type { ApiResponse } from './api-response.model';
import type { User } from './user.model';
import type { UserRole } from './enums';

export interface TenantMembership {
  tenantId: string | null;
  tenantSlug: string;
  tenantName: string;
  parentId?: string | null;
  isInherited?: boolean;
  isSuperAdmin?: boolean;
  role: UserRole;
}

/**
 * Login API may return memberships with a nested `tenant` object instead of flat slug/name fields.
 */
export function normalizeTenantMembershipsFromLogin(raw: unknown[] | undefined): TenantMembership[] {
  if (!Array.isArray(raw) || raw.length === 0) return [];
  const out: TenantMembership[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const m = item as Record<string, unknown>;
    const role = m['role'] as UserRole | undefined;
    if (!role) continue;

    const tenant = m['tenant'] as Record<string, unknown> | null | undefined;
    const tenantSlug =
      (typeof m['tenantSlug'] === 'string' && m['tenantSlug']) ||
      (tenant && typeof tenant['slug'] === 'string' && tenant['slug']) ||
      '';
    const tenantName =
      (typeof m['tenantName'] === 'string' && m['tenantName']) ||
      (tenant && typeof tenant['name'] === 'string' && tenant['name']) ||
      '';
    const parentId =
      (typeof m['parentId'] === 'string' && m['parentId']) ||
      (tenant && typeof tenant['parentId'] === 'string' && tenant['parentId']) ||
      null;
    const isInherited = m['isInherited'] === true;
    const isSuperAdmin = m['isSuperAdmin'] === true;

    let tenantId: string | null = null;
    if (typeof m['tenantId'] === 'string') tenantId = m['tenantId'];
    else if (tenant && typeof tenant['id'] === 'string') tenantId = tenant['id'];

    if (!tenantSlug && !tenantId) continue;
    out.push({ tenantId, tenantSlug, tenantName, parentId, isInherited, isSuperAdmin, role });
  }
  return out;
}

/** Backend may set `requiresTenantSelection` on the envelope root or inside `data`. */
export type LoginApiEnvelope = ApiResponse<AuthResponse> & {
  requiresTenantSelection?: boolean;
};

/**
 * Auth response from login/refresh endpoints
 */
export interface AuthResponse {
  user?: User;
  accessToken?: string;
  refreshToken?: string;
  requiresTenantSelection?: boolean;
  memberships?: TenantMembership[];
}

/**
 * Login credentials
 */
export interface LoginCredentials {
  email: string;
  password: string;
  tenantSlug?: string;
  selectedTenantId?: string | null;
  selectedRole?: UserRole;
  memberships?: TenantMembership[];
}
