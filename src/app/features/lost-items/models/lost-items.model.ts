export type LostSourceType = 'INTERNAL' | 'GET_PASS_RETURN';
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
}

export interface LostCreatePayload {
  sourceLocationId: string;
  reason: string;
  notes?: string | null;
  documentDate?: string;
  lines: Array<{ itemId: string; qty: number; notes?: string | null }>;
}
