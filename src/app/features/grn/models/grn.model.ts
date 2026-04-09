import type { GrnStatus } from '../../../core/models/enums';

/** Maps backend `GrnStatus` to `GRN.STATUS.*` i18n key suffix (4 main labels + draft for legacy rows). */
export function grnStatusI18nSuffix(status: GrnStatus): 'PENDING' | 'APPROVED' | 'POSTED' | 'REJECTED' | 'DRAFT' {
  switch (status) {
    case 'VALIDATED':
    case 'PENDING_APPROVAL':
      return 'PENDING';
    case 'APPROVED':
      return 'APPROVED';
    case 'POSTED':
      return 'POSTED';
    case 'REJECTED':
      return 'REJECTED';
    case 'DRAFT':
      return 'DRAFT';
  }
}

/** Row from `GET /grn` list (nested payload). */
export interface GrnListRow {
  id: string;
  grnNumber: string;
  status: GrnStatus;
  receivingDate: string;
  vendorNameSnapshot?: string;
  vendor?: { id: string; name: string } | null;
  location?: { id: string; name: string } | null;
  rejectionReason?: string | null;
  rejectedByUser?: { firstName: string; lastName: string } | null;
  isEditedAfterRejection?: boolean;
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
  /** Present on API payloads; used when enriching `uom` is missing. */
  internalUomId?: string | null;
  isMapped: boolean;
  item?: { id?: string; name: string; barcode?: string | null } | null;
  uom?: { id?: string; name: string; abbreviation?: string | null } | null;
}

/** Editable row on GRN detail when status is REJECTED (mirrors manual create lines). */
export interface GrnRejectedLineDraft {
  clientKey: string;
  itemId: string;
  itemName: string;
  barcode: string;
  imageUrl: string | null;
  uomId: string;
  uomName: string;
  receivedQty: string;
  unitPrice: string | number;
}

export interface GrnDetail extends Omit<GrnListRow, '_count'> {
  vendorNameSnapshot: string;
  pdfAttachmentUrl: string;
  notes: string | null;
  rejectionReason: string | null;
  postedAt: string | null;
  lines: GrnLineDetail[];
  lastEditedBy?: string | null;
  importedByUser?: { firstName: string; lastName: string };
  postedByUser?: { firstName: string; lastName: string } | null;
  rejectedByUser?: { firstName: string; lastName: string } | null;
  lastEditedByUser?: { firstName: string; lastName: string } | null;
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
  uomName?: string;
  imageUrl?: string | null;
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
  imageUrl: string | null;
  uomId: string;
  uomName: string;
  receivedQty: string;
  unitPrice: string | number;
}
