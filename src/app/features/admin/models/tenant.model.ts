import type { PlanType } from '../../../core/models/enums';

/** Subscription lifecycle status managed by licensing logic. */
export type SubscriptionStatus = 'ACTIVE' | 'TRIAL' | 'EXPIRED' | 'SUSPENDED';
/** Administrative account status (takes priority in UI). */
export type TenantAdminStatus = 'ACTIVE' | 'SUSPENDED';

export interface TenantRow {
  id: string;
  name: string;
  slug: string;
  parentId?: string | null;
  parentName?: string | null;
  /** Primary org manager profile (GET tenant detail; used for edit organization). */
  organizationManager?: {
    firstName?: string | null;
    lastName?: string | null;
    email?: string | null;
  } | null;
  /** Org-level manager email (list/detail; used for “add hotel under org”). */
  managerEmail?: string | null;
  /** Some APIs expose the org manager email under this key. */
  orgManagerEmail?: string | null;
  primaryManagerEmail?: string | null;
  branches?: TenantRow[];
  hasBranches?: boolean;
  maxBranches?: number;
  planType: PlanType;
  subStatus: SubscriptionStatus;
  /**
   * Operational suspension (super-admin). Distinct from subscription `subStatus`.
   * Returned by GET `/api/super-admin/tenants` and tenant detail; list UI normalizes if absent.
   */
  adminStatus: TenantAdminStatus;
  isActive: boolean;
  licenseStartDate: string;
  licenseEndDate: string | null;
  maxUsers: number;
  /** Super-admin tenants list often returns this; falls back to `_count.users` when absent. */
  activeUsersCount?: number;
  _count?: { users: number; locations?: number };
}
