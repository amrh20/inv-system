import type { ReturnsAccountabilityType } from '../../../shared/models/returns-accountability.model';

export type LostSourceType = 'INTERNAL' | 'GET_PASS_RETURN';

/** Body for returns-tab approval steps (get-pass accountability). */
export type LostApprovePayload = { accountability: ReturnsAccountabilityType };
export type LostWorkflowStatus =
  | 'DRAFT'
  | 'DEPT_APPROVED'
  | 'COST_CONTROL_APPROVED'
  | 'FINANCE_APPROVED'
  | 'APPROVED';

export interface LostItemsListRow {
  id: string;
  documentNo: string;
  status: LostWorkflowStatus;
  sourceType: LostSourceType;
  getPassId?: string | null;
  getPass?: { id: string; passNo: string } | null;
  reason?: string | null;
  notes?: string | null;
  createdAt: string;
  createdByUser?: { id?: string; firstName: string; lastName: string } | null;
  itemName: string;
  itemBarcode: string | null;
  qtyLost: number;
  _count?: { lines: number };
  /** When present (tenant-wide approvers), drives workflow actions on the list. */
  approvalRequests?: LostApprovalRequest[];
}

export interface LostCreatePayload {
  sourceLocationId: string;
  reason: string;
  notes?: string | null;
  documentDate?: string;
  lines: Array<{ itemId: string; qty: number; notes?: string | null }>;
}

/** Optional approval trail on lost document detail (same shape as breakage workflow). */
export interface LostApprovalStepDetail {
  id: string;
  stepNumber: number;
  requiredRole: { code: string } | string;
  status: string;
  actedAt?: string | null;
  comment?: string | null;
  accountabilityType?: string | null;
  actedByUser?: { id?: string; firstName: string; lastName: string } | null;
}

export interface LostApprovalRequest {
  id: string;
  currentStep: number;
  totalSteps?: number;
  status?: string;
  steps: LostApprovalStepDetail[];
}

export interface LostLineDetail {
  id: string;
  itemId: string;
  locationId: string;
  qtyInBaseUnit: string | number;
  notes?: string | null;
  item?: { id: string; name: string; barcode?: string | null } | null;
  location?: { id: string; name: string } | null;
}

export interface LostDetail extends LostItemsListRow {
  approvalRequests?: LostApprovalRequest[];
  lines?: LostLineDetail[];
}
