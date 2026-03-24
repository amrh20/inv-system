import type { UserRole } from '../../../core/models/enums';

/** Tenant-scoped roles assignable when creating/editing users (matches React UsersPage). */
export const ASSIGNABLE_USER_ROLES: readonly UserRole[] = [
  'ADMIN',
  'STOREKEEPER',
  'DEPT_MANAGER',
  'COST_CONTROL',
  'FINANCE_MANAGER',
  'AUDITOR',
  'SECURITY',
];

export interface UserListRow {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  departmentId?: string | null;
  department: string | null;
  phone: string | null;
  isActive: boolean;
  lastLoginAt: string | null;
}

export interface UserCreatePayload {
  firstName: string;
  lastName: string;
  email: string;
  password?: string;
  role: UserRole;
  departmentId?: string;
  phone?: string;
  isActive?: boolean;
}

/** Existing user returned by `GET /users/search-existing` for cross-tenant import. */
export interface ExistingUserSearchHit {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string | null;
}

/** Value bound to create-mode email `nz-select` (existing hit vs new email). */
export type EmailPickOption =
  | { source: 'existing'; email: string; user: ExistingUserSearchHit }
  | { source: 'new'; email: string };

export interface AuditLogRow {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  beforeValue: unknown;
  afterValue: unknown;
  note?: string | null;
  createdAt?: string;
  changedAt?: string | null;
  changedBy?: string | null;
  changedByUser?: {
    firstName?: string | null;
    lastName?: string | null;
    email?: string | null;
  } | null;
}

export interface OpeningBalanceSetting {
  value: string | null;
  reason?: string | null;
  updatedAt?: string | null;
}
