/** Movement document row from GET /movements (list). */
export interface MovementDocumentRow {
  id: string;
  documentNo: string;
  documentDate: string;
  movementType: string;
  status: 'DRAFT' | 'POSTED' | 'REJECTED';
  sourceLocationId?: string | null;
  destLocationId?: string | null;
  supplierId?: string | null;
  /** Backend field; UI may label as “reference”. */
  reason?: string | null;
  referenceNumber?: string | null;
  department?: string | null;
  notes?: string | null;
  _count?: { lines: number };
}

/** Line as returned on GET /movements/:id (nested relations + quantities). */
export interface MovementLineDetail {
  id?: string;
  /** May be omitted on some API payloads when `item.id` is present instead. */
  itemId?: string;
  item?: { id?: string; name: string; barcode?: string | null } | null;
  locationId?: string | null;
  location?: { name: string } | null;
  qtyRequested: number | string;
  qtyInBaseUnit?: number | string;
  unitCost?: number | string;
  totalValue?: number | string;
  notes?: string | null;
}

/** Full movement document from GET /movements/:id. */
export interface MovementDocumentDetail extends MovementDocumentRow {
  lines: MovementLineDetail[];
}

/** Payload line for POST /movements and PUT /movements/:id. */
export interface MovementLinePayload {
  itemId: string;
  locationId?: string | null;
  qtyRequested: number;
  unitCost?: number;
  totalValue?: number;
  notes?: string | null;
}

/** Payload for POST /movements (create) and PUT /movements/:id (update). */
export interface MovementDocumentPayload {
  movementType: string;
  documentDate: string;
  sourceLocationId?: string | null;
  destLocationId?: string | null;
  supplierId?: string | null;
  reason?: string | null;
  department?: string | null;
  notes?: string | null;
  lines: MovementLinePayload[];
}

/** Form line row (includes display snapshots from API; stripped before save). */
export type MovementLineFormRow = MovementLinePayload & {
  itemNameSnapshot?: string;
  lineLocationNameSnapshot?: string;
  qtyInBaseUnitSnapshot?: number;
};

/** Client-side form state (reference number maps to API `reason`). */
export interface MovementFormState {
  movementType: string;
  documentDate: string;
  sourceLocationId: string | null;
  destLocationId: string | null;
  supplierId: string | null;
  referenceNumber: string;
  department: string;
  notes: string;
  lines: MovementLineFormRow[];
}
