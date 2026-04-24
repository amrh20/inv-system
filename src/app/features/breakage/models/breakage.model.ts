import type { MovementStatus } from '../../../core/models/enums';

export type BreakageSourceType = 'INTERNAL' | 'GET_PASS_RETURN';
export type SuggestedActionType = 'EMPLOYEE' | 'HOTEL';
export type BreakageWorkflowStatus =
  | 'DRAFT'
  | 'DEPT_APPROVED'
  | 'COST_CONTROL_APPROVED'
  | 'FINANCE_APPROVED'
  | 'APPROVED'
  | 'REJECTED'
  | 'VOID';

export interface BreakageUserRef {
  id?: string;
  firstName: string;
  lastName: string;
  role?: string;
}

export interface ApprovalStepDetail {
  id: string;
  stepNumber: number;
  requiredRole: { code: string } | string;
  status: string;
  actedAt?: string | null;
  comment?: string | null;
  /** Set for get-pass return approvals when the step records accountability. */
  accountabilityType?: string | null;
  actedByUser?: BreakageUserRef | null;
}

export interface BreakageApprovalRequest {
  id: string;
  currentStep: number;
  totalSteps: number;
  status: string;
  steps: ApprovalStepDetail[];
}

export interface BreakageListRow {
  id: string;
  documentNo: string;
  status: BreakageWorkflowStatus | MovementStatus;
  sourceType?: BreakageSourceType;
  getPassId?: string | null;
  getPass?: { id: string; passNo: string } | null;
  createdAt: string;
  reason?: string | null;
  suggestedAction?: SuggestedActionType | null;
  responsibleEmployeeName?: string | null;
  /** Accountability / remarks; used heavily on GET_PASS_RETURN list rows. */
  notes?: string | null;
  /** Total qty (damaged) in base units when the list API supplies an aggregate. */
  totalQtyDamaged?: number | null;
  photoKey?: string | null;
  photoUrl?: string | null;
  createdByUser?: BreakageUserRef | null;
  _count?: { lines: number };
  /** Present for tenant-wide approvers; drives list workflow actions. */
  approvalRequests?: BreakageApprovalRequest[];
}

export interface BreakageLineDetail {
  id: string;
  itemId: string;
  locationId: string;
  qtyInBaseUnit: string | number;
  notes?: string | null;
  item?: { id: string; name: string; barcode?: string | null } | null;
  location?: { id: string; name: string } | null;
}

export interface BreakageAttachmentMeta {
  filename: string;
  originalName: string;
  url: string;
  mimetype?: string;
  size?: number;
  uploadedBy?: string;
  uploadedAt?: string;
}

export interface BreakageDetail {
  id: string;
  documentNo: string;
  status: BreakageWorkflowStatus | MovementStatus;
  sourceType?: BreakageSourceType;
  getPassId?: string | null;
  getPass?: { id: string; passNo: string } | null;
  reason?: string | null;
  suggestedAction?: SuggestedActionType | null;
  responsibleEmployeeName?: string | null;
  notes?: string | null;
  createdAt: string;
  postedAt?: string | null;
  attachmentUrl?: string | null;
  sourceLocationId?: string | null;
  photoKey?: string | null;
  photoUrl?: string | null;
  createdBy?: string;
  createdByUser?: BreakageUserRef | null;
  lines: BreakageLineDetail[];
  approvalRequests?: BreakageApprovalRequest[];
}

export interface BreakageCreatePayload {
  sourceLocationId: string;
  reason: string;
  notes?: string | null;
  documentDate?: string;
  suggestedAction: SuggestedActionType;
  responsibleEmployeeName?: string | null;
  lines: Array<{ itemId: string; qty: number; notes?: string | null }>;
  photo?: File | null;
}
