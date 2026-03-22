/** Movement document row from GET /movements (list). */
export interface MovementDocumentRow {
  id: string;
  documentNo: string;
  documentDate: string;
  movementType: string;
  status: 'DRAFT' | 'POSTED' | 'REJECTED';
  sourceLocationId?: string | null;
  destLocationId?: string | null;
  referenceNumber?: string | null;
  department?: string | null;
  notes?: string | null;
  _count?: { lines: number };
}

/** Movement line for create/update payload and document detail. */
export interface MovementLinePayload {
  itemId: string;
  locationId?: string | null;
  qtyRequested: number;
  unitCost?: number;
  totalValue?: number;
  notes?: string | null;
}

/** Full movement document from GET /movements/:id. */
export interface MovementDocumentDetail extends MovementDocumentRow {
  lines: Array<{
    itemId: string;
    locationId?: string | null;
    qtyRequested: number;
    unitCost?: number;
    totalValue?: number;
    notes?: string | null;
  }>;
}

/** Payload for POST /movements (create) and PUT /movements/:id (update). */
export interface MovementDocumentPayload {
  movementType: string;
  documentDate: string;
  sourceLocationId?: string | null;
  destLocationId?: string | null;
  referenceNumber?: string | null;
  department?: string | null;
  notes?: string | null;
  lines: MovementLinePayload[];
}
