import type { GrnStatus } from '../../../core/models/enums';

/** Row from `GET /grn` list (nested payload). */
export interface GrnListRow {
  id: string;
  grnNumber: string;
  status: GrnStatus;
  receivingDate: string;
  vendorNameSnapshot?: string;
  vendor?: { id: string; name: string } | null;
  location?: { id: string; name: string } | null;
  _count?: { lines: number };
}

export interface GrnListApiPayload {
  data: GrnListRow[];
  total: number;
}

export interface GrnLineDetail {
  id: string;
  futurelogItemCode: string;
  futurelogDescription: string;
  futurelogUom: string;
  orderedQty: string | number;
  receivedQty: string | number;
  unitPrice: string | number;
  conversionFactor: string | number;
  qtyInBaseUnit: string | number;
  internalItemId: string | null;
  isMapped: boolean;
}

export interface GrnDetail extends Omit<GrnListRow, '_count'> {
  vendorNameSnapshot: string;
  pdfAttachmentUrl: string;
  notes: string | null;
  rejectionReason: string | null;
  postedAt: string | null;
  lines: GrnLineDetail[];
  importedByUser?: { firstName: string; lastName: string };
}

/** Manual / Excel line payload sent as JSON string in `POST /grn` FormData. */
export interface GrnCreateLinePayload {
  itemId: string;
  uomId: string;
  orderedQty: number;
  receivedQty: number;
  unitPrice: number;
}

/** `POST /grn/import/preview` response body. */
export interface GrnImportPreviewRow {
  rowNum: number;
  status: 'VALID' | 'ERROR';
  itemName?: string;
  barcode?: string;
  receivedQty: string | number;
  unitPrice?: string | number;
  orderedQty?: string | number;
  itemId?: string;
  uomId?: string;
  errors?: string[];
}

export interface GrnImportPreviewData {
  total: number;
  valid: number;
  invalid?: number;
  rows: GrnImportPreviewRow[];
}

export interface GrnManualLineDraft {
  itemId: string;
  itemName: string;
  barcode: string;
  uomId: string;
  uomName: string;
  orderedQty: string;
  receivedQty: string;
  unitPrice: string | number;
}
