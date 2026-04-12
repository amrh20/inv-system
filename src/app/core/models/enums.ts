/**
 * Enums derived from Prisma schema
 */

export type UserRole =
  | 'SUPER_ADMIN'
  | 'ADMIN'
  | 'ORG_MANAGER'
  | 'STOREKEEPER'
  | 'DEPT_MANAGER'
  | 'COST_CONTROL'
  | 'FINANCE_MANAGER'
  | 'AUDITOR'
  | 'SECURITY'
  | 'GENERAL_MANAGER';

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

/** Prisma `GetPassType` */
export type GetPassType = 'TEMPORARY' | 'CATERING' | 'PERMANENT';

/** Prisma `GetPassStatus` */
export type GetPassStatus =
  | 'DRAFT'
  | 'PENDING_DEPT'
  | 'PENDING_COST_CONTROL'
  | 'PENDING_FINANCE'
  | 'PENDING_GM'
  | 'PENDING_SECURITY'
  | 'APPROVED'
  | 'OUT'
  | 'RECEIVED_AT_DESTINATION'
  | 'PARTIALLY_RETURNED'
  | 'RETURNED'
  | 'CLOSED'
  | 'REJECTED';

/** Prisma `GetPassLineStatus` */
export type GetPassLineStatus =
  | 'PENDING'
  | 'OUT'
  | 'PARTIALLY_RETURNED'
  | 'RETURNED'
  | 'LOST';
