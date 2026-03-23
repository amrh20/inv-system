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
  borrowingEntity: string;
  createdAt: string;
  department?: { name: string } | null;
  createdByUser?: GetPassUserRef | null;
}

export interface GetPassLineDetail {
  id: string;
  itemId: string;
  locationId: string;
  qty: string | number;
  qtyReturned: string | number;
  conditionOut?: string | null;
  status: GetPassLineStatus;
  item?: { name: string; barcode?: string | null } | null;
  location?: { name: string } | null;
  returns?: GetPassReturnDetail[];
}

export interface GetPassReturnDetail {
  id: string;
  qtyReturned: string | number;
  conditionIn?: string | null;
  returnDate: string;
  notes?: string | null;
  registeredByUser?: GetPassUserRef | null;
}

export interface GetPassDetail extends GetPassListRow {
  departmentId?: string | null;
  expectedReturnDate?: string | null;
  reason?: string | null;
  notes?: string | null;
  deptApprovedAt?: string | null;
  financeApprovedAt?: string | null;
  securityApprovedAt?: string | null;
  deptApprover?: GetPassUserRef | null;
  financeApprover?: GetPassUserRef | null;
  securityApprover?: GetPassUserRef | null;
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
  reason?: string | null;
  notes?: string | null;
  lines: GetPassLinePayload[];
}

export interface GetPassUpdatePayload {
  transferType?: GetPassType;
  departmentId?: string;
  borrowingEntity?: string;
  expectedReturnDate?: string | null;
  reason?: string | null;
  notes?: string | null;
  lines?: GetPassLinePayload[];
}

export interface GetPassReturnLinePayload {
  lineId: string;
  qtyReturned: number;
  conditionIn?: string | null;
  notes?: string | null;
  isDamaged?: boolean;
  isLost?: boolean;
}
