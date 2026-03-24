import type { UserRole } from './enums';

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
  department: string | null;
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
  role: UserRole;
}

/**
 * Tenant model
 */
export interface Tenant {
  id: string;
  name: string;
  slug: string;
  subscriptionTier: string;
  logoUrl: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}
