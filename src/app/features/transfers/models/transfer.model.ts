import type { TransferStatus } from '../../../core/models/enums';

export interface TransferUserRef {
  firstName: string;
  lastName: string;
}

export interface TransferListRow {
  id: string;
  transferNo: string;
  status: TransferStatus;
  transferDate: string;
  sourceLocationId?: string;
  destLocationId?: string;
  sourceLocation?: { name: string } | null;
  destLocation?: { name: string } | null;
  requestedByUser?: TransferUserRef | null;
  _count?: { lines: number };
}

export interface TransferListApiPayload {
  total: number;
  page: number;
  limit: number;
  data: TransferListRow[];
}

export interface TransferLineDetail {
  id: string;
  itemId: string;
  uomId: string;
  requestedQty: string | number;
  receivedQty?: string | number | null;
  unitCost?: string | number | null;
  totalValue?: string | number | null;
  notes?: string | null;
  item?: { name: string } | null;
  uom?: { abbreviation: string } | null;
}

export interface TransferDetail extends TransferListRow {
  sourceLocationId: string;
  destLocationId: string;
  reason?: string | null;
  notes?: string | null;
  rejectionReason?: string | null;
  createdAt: string;
  approvedAt?: string | null;
  dispatchedAt?: string | null;
  receivedAt?: string | null;
  closedAt?: string | null;
  approvedByUser?: TransferUserRef | null;
  receivedByUser?: TransferUserRef | null;
  rejectedByUser?: TransferUserRef | null;
  lines: TransferLineDetail[];
}

export interface TransferCreatePayload {
  sourceLocationId: string;
  destLocationId: string;
  transferDate?: string;
  requiredBy?: string | null;
  reason?: string | null;
  notes?: string | null;
  lines: TransferLinePayload[];
}

export interface TransferLinePayload {
  itemId: string;
  uomId: string;
  requestedQty: number;
  notes?: string | null;
}

export interface TransferUpdatePayload {
  sourceLocationId?: string;
  destLocationId?: string;
  requiredBy?: string | null;
  reason?: string | null;
  notes?: string | null;
  lines?: TransferLinePayload[];
}
