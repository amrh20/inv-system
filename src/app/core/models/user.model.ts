import type { SubscriptionStatus, UserRole } from './enums';

/**
 * User model (API response - excludes passwordHash)
 */
export interface User {
  id: string;
  tenantId: string | null;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  permissions: string[];
  department: string | null;
  /** Tenant membership department (UUID), when assigned in user management. */
  departmentId?: string | null;
  phone: string | null;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
  tenant?: Tenant | null;
  memberships?: UserMembership[];
}

export interface UserMembership {
  tenantId: string | null;
  tenantSlug: string;
  tenantName: string;
  parentId?: string | null;
  isInherited?: boolean;
  isSuperAdmin?: boolean;
  role: UserRole;
}

/**
 * Tenant model
 */
export interface Tenant {
  id: string;
  /** Set when this tenant is a hotel/property under a parent organization tenant. */
  parentId?: string | null;
  name: string;
  slug: string;
  subscriptionTier: string;
  /** Present when API returns tenant subscription lifecycle (e.g. login / me). */
  subStatus?: SubscriptionStatus;
  logoUrl: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}
