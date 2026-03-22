/** Query params accepted by GET /api/ledger */
export interface LedgerListParams {
  skip?: number;
  take?: number;
  itemId?: string;
  locationId?: string;
  dateFrom?: string;
  dateTo?: string;
  movementType?: string;
  movementDocumentId?: string;
}

export interface LedgerEntryRef {
  id: string;
  name: string;
  barcode?: string | null;
}

export interface LedgerEntryRow {
  id: string;
  tenantId?: string;
  itemId: string;
  locationId: string;
  movementType: string;
  qtyIn: string | number;
  qtyOut: string | number;
  unitCost: string | number;
  totalValue: string | number;
  referenceNo?: string | null;
  referenceId?: string | null;
  notes?: string | null;
  createdAt: string;
  item?: LedgerEntryRef | null;
  location?: LedgerEntryRef | null;
  runningBalance?: string | number;
}

export interface LedgerListResult {
  entries: LedgerEntryRow[];
  total: number;
}

/** IN = net receipt, OUT = net issue, TRANSFER = transfer in/out ledger types */
export type MovementDirectionFilter = '' | 'IN' | 'OUT' | 'TRANSFER';

export interface MovementsListParams {
  skip?: number;
  take?: number;
  itemId?: string;
  locationId?: string;
  type?: MovementDirectionFilter;
  dateFrom?: string;
  dateTo?: string;
}

export interface MovementsListResult {
  rows: LedgerEntryRow[];
  /** Count after direction filter (may be capped by fetch size) */
  total: number;
  /** True when direction filter was applied and fetch used a high take cap */
  capped?: boolean;
}
