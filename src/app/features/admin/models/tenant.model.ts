import type { PlanType } from '../../../core/models/enums';

/** Subscription status from Prisma schema */
export type SubscriptionStatus = 'ACTIVE' | 'TRIAL' | 'EXPIRED' | 'SUSPENDED';

export interface TenantRow {
  id: string;
  name: string;
  slug: string;
  parentId?: string | null;
  parentName?: string | null;
  branches?: TenantRow[];
  hasBranches?: boolean;
  maxBranches?: number;
  planType: PlanType;
  subStatus: SubscriptionStatus;
  isActive: boolean;
  licenseStartDate: string;
  licenseEndDate: string | null;
  maxUsers: number;
  _count?: { users: number; locations?: number };
}
