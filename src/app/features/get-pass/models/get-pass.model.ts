import type { GetPassLineStatus, GetPassStatus, GetPassType } from '../../../core/models/enums';

export interface GetPassUserRef {
  id?: string;
  firstName?: string | null;
  lastName?: string | null;
}

export interface GetPassListRow {
  id: string;
  passNo: string;
  transferType: GetPassType;
  status: GetPassStatus;
  tenantId?: string | null;
  sourceTenantId?: string | null;
  targetTenantId?: string | null;
  borrowingEntity: string;
  createdAt: string;
  updatedAt?: string;
  department?: { name: string } | null;
  createdByUser?: GetPassUserRef | null;
  /** Issuing property (org-wide outgoing list from root ORG_MANAGER context). */
  tenant?: { id?: string; name?: string; slug?: string; email?: string } | null;
  /** Source property when listing incoming internal transfers (GET /get-passes/incoming). */
  sourceTenant?: { id?: string; name?: string; slug?: string; email?: string } | null;
  /** Receiving property (org-wide incoming list from root ORG_MANAGER context). */
  targetTenant?: { id?: string; name?: string; slug?: string; email?: string } | null;
  /** Present when destination hotel recorded final department acceptance (internal transfers). */
  destinationDeptAcceptedAt?: string | null;
  /** Destination security marked reverse shipment exit from gate. */
  destinationSecurityExitAt?: string | null;
  /** Computed by backend for temporary/catering passes that passed expected return date. */
  isOverdue?: boolean;
}

export interface GetPassLineDetail {
  id: string;
  itemId: string;
  locationId: string;
  qty: string | number;
  qtyReturned: string | number;
  qtyReceivedAtDestination?: string | number;
  qtyDiscrepancyAtDestination?: string | number;
  conditionOut?: string | null;
  receivedCondition?: string | null;
  discrepancyReason?: string | null;
  status: GetPassLineStatus;
  item?: { name: string; barcode?: string | null } | null;
  location?: { name: string } | null;
  returns?: GetPassReturnDetail[];
}

export interface GetPassReturnDetail {
  id: string;
  qtyReturned: string | number;
  qtyGood?: string | number;
  qtyLost?: string | number;
  qtyDamaged?: string | number;
  isLost?: boolean;
  isDamaged?: boolean;
  conditionIn?: string | null;
  returnDate: string;
  notes?: string | null;
  registeredByUser?: GetPassUserRef | null;
}

export interface GetPassDetail extends GetPassListRow {
  /** Issuing hotel (included on detail for destination viewers). */
  tenant?: { id?: string; name?: string; slug?: string; email?: string } | null;
  targetTenant?: { id?: string; name?: string; slug?: string; email?: string } | null;
  destinationSecurityApprovedAt?: string | null;
  destinationSecurityApprovedBy?: string | null;
  destinationSecurityApprover?: GetPassUserRef | null;
  receivedAt?: string | null;
  receivedCondition?: string | null;
  receivedNotes?: string | null;
  receivedBy?: GetPassUserRef | null;
  destinationDeptAcceptedBy?: string | null;
  destinationDeptAccepter?: GetPassUserRef | null;
  destinationSecurityExitBy?: string | null;
  destinationSecurityExitByUser?: GetPassUserRef | null;
  destinationDepartmentId?: string | null;
  destinationLocationId?: string | null;
  departmentId?: string | null;
  expectedReturnDate?: string | null;
  /** Set when transfer type is temporary (API may mirror expected return). */
  returnDate?: string | null;
  isInternalTransfer?: boolean;
  targetTenantId?: string | null;
  reason?: string | null;
  notes?: string | null;
  rejectionReason?: string | null;
  /** FK user ids (Prisma); nested approver relations carry display names. */
  deptApprovedBy?: string | null;
  costControlApprovedBy?: string | null;
  financeApprovedBy?: string | null;
  gmApprovedBy?: string | null;
  securityApprovedBy?: string | null;
  deptApprovedAt?: string | null;
  costControlApprovedAt?: string | null;
  financeApprovedAt?: string | null;
  gmApprovedAt?: string | null;
  securityApprovedAt?: string | null;
  deptApprover?: GetPassUserRef | null;
  costControlApprover?: GetPassUserRef | null;
  financeApprover?: GetPassUserRef | null;
  gmApprover?: GetPassUserRef | null;
  securityApprover?: GetPassUserRef | null;
  reverseAuditTrail?: {
    shipBackAt?: string | null;
    shipBackBy?: string | null;
    shipBackByUser?: GetPassUserRef | null;
    confirmReturnArrivalAt?: string | null;
    confirmReturnArrivalBy?: string | null;
    confirmReturnArrivalByUser?: GetPassUserRef | null;
    acceptReturnDeptAt?: string | null;
    acceptReturnDeptBy?: string | null;
    acceptReturnDeptByUser?: GetPassUserRef | null;
  } | null;
  lines: GetPassLineDetail[];
}

export interface GetPassLinePayload {
  itemId: string;
  locationId: string;
  qty: number;
  conditionOut?: string | null;
}

export interface GetPassCreatePayload {
  transferType: GetPassType;
  departmentId: string;
  borrowingEntity: string;
  expectedReturnDate?: string | null;
  /** Required for temporary transfers when using the new contract. */
  returnDate?: string | null;
  isInternalTransfer?: boolean;
  targetTenantId?: string | null;
  reason?: string | null;
  notes?: string | null;
  lines: GetPassLinePayload[];
}

export interface GetPassUpdatePayload {
  transferType?: GetPassType;
  departmentId?: string;
  borrowingEntity?: string;
  expectedReturnDate?: string | null;
  returnDate?: string | null;
  isInternalTransfer?: boolean;
  targetTenantId?: string | null;
  reason?: string | null;
  notes?: string | null;
  lines?: GetPassLinePayload[];
}

/** Row from GET /api/organization/sister-hotels */
export interface SisterHotelRow {
  id: string;
  name: string;
}

export interface GetPassConfirmReceiptLinePayload {
  lineId: string;
  receivedQty: number;
  condition?: string | null;
  discrepancyReason?: string | null;
}

/** POST /get-passes/:id/confirm-receipt */
export interface GetPassConfirmReceiptPayload {
  receivedCondition: string;
  notes: string;
  lines: GetPassConfirmReceiptLinePayload[];
}

export interface GetPassConfirmReturnArrivalLinePayload {
  lineId: string;
  receivedQty: number;
  condition: string;
}

export interface GetPassConfirmReturnArrivalPayload {
  lines: GetPassConfirmReturnArrivalLinePayload[];
}

/** POST /get-passes/:id/accept-into-department */
export interface GetPassAcceptIntoDepartmentPayload {
  targetDepartmentId: string;
  targetLocationId: string;
}

export interface GetPassReturnLinePayload {
  lineId: string;
  /** Good-condition quantity (restores stock). */
  qtyGood: number;
  lostQty: number;
  damagedQty: number;
  conditionIn?: string | null;
  notes?: string | null;
}

export interface GetPassDiscrepancyRow {
  id: string;
  qty: string | number;
  qtyReceivedAtDestination?: string | number;
  qtyDiscrepancyAtDestination?: string | number;
  discrepancyReason?: string | null;
  item?: { id?: string; name?: string | null } | null;
  getPass?: {
    id: string;
    passNo: string;
    tenant?: { id?: string; name?: string | null } | null;
    targetTenant?: { id?: string; name?: string | null } | null;
  } | null;
}
