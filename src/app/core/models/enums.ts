/**
 * Enums derived from Prisma schema
 */

export type UserRole =
  | 'SUPER_ADMIN'
  | 'ADMIN'
  | 'STOREKEEPER'
  | 'DEPT_MANAGER'
  | 'COST_CONTROL'
  | 'FINANCE_MANAGER'
  | 'AUDITOR'
  | 'SECURITY_MANAGER';

export type PlanType = 'BASIC' | 'PRO' | 'ENTERPRISE' | 'CUSTOM';

export type SubscriptionStatus = 'ACTIVE' | 'TRIAL' | 'EXPIRED' | 'SUSPENDED';

export type MovementType =
  | 'OPENING_BALANCE'
  | 'RECEIVE'
  | 'ISSUE'
  | 'TRANSFER'
  | 'TRANSFER_OUT'
  | 'TRANSFER_IN'
  | 'RETURN'
  | 'ADJUSTMENT'
  | 'BREAKAGE'
  | 'COUNT_ADJUSTMENT'
  | 'LOAN_WRITE_OFF'
  | 'GET_PASS_OUT'
  | 'GET_PASS_RETURN';

export type LocationType = 'MAIN_STORE' | 'OUTLET_STORE' | 'DEPARTMENT';

export type MovementStatus = 'DRAFT' | 'PENDING_APPROVAL' | 'POSTED' | 'VOID' | 'REJECTED';

export type GrnStatus =
  | 'DRAFT'
  | 'VALIDATED'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'POSTED'
  | 'REJECTED';

export type RequisitionStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'APPROVED'
  | 'PARTIALLY_ISSUED'
  | 'FULLY_ISSUED'
  | 'CLOSED'
  | 'REJECTED';

export type TransferStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'APPROVED'
  | 'IN_TRANSIT'
  | 'RECEIVED'
  | 'CLOSED'
  | 'REJECTED';
