import type { UserRole } from '../../../core/models/enums';

export interface StockLocation {
  id: string;
  name: string;
}

export interface StockReportItem {
  itemId: string;
  sr?: number;
  name: string;
  barcode?: string | null;
  code?: string | null;
  category?: string | null;
  supplier?: string | null;
  imageUrl?: string | null;
  unitPrice: number;
  openStock: number;
  openValue: number;
  grnQty?: number;
  grnValue?: number;
  breakages?: number;
  totalOutOnPass?: number;
  theorQty?: number;
  theorValue?: number;
  locationQtys?: Record<string, number>;
  bookLocationQtys?: Record<string, number>;
  physicalQty?: number;
  varianceQty?: number;
  varianceValue?: number;
  closeStock: number;
}

export interface StockReportTotals {
  openStock: number;
  openValue: number;
  grnQty?: number;
  grnValue?: number;
  breakages: number;
  theorQty?: number;
  theorValue?: number;
  varianceQty?: number;
  varianceValue?: number;
  closeStock: number;
  locationTotals?: Record<string, number>;
}

/** GET /api/stock-report raw payload */
export interface StockReportData {
  items: StockReportItem[];
  locations: StockLocation[];
  totals: StockReportTotals;
}

export type SavedStockReportStatus =
  | 'DRAFT'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'POSTED'
  | 'REJECTED';

export interface SavedStockReportListRow {
  id: string;
  reportNo: string;
  createdAt: string;
  dateGenerated?: string;
  status: SavedStockReportStatus;
  totalValue: number | string;
  location?: { id: string; name: string };
}

export interface SavedStockReportDetail extends Record<string, unknown> {
  id: string;
  reportNo: string;
  status: SavedStockReportStatus;
  notes?: string | null;
  totalValue?: number;
  createdAt: string;
  dateGenerated?: string;
  location?: { id: string; name: string };
  createdByUser?: { firstName?: string; lastName?: string };
  lines: StockReportLine[];
}

export interface StockReportLine {
  id: string;
  openingQty?: number;
  closingQty?: number;
  inwardQty?: number;
  inwardValue?: number;
  grnQty?: number;
  breakages?: number;
  outOnPassQty?: number;
  outwardQty?: number;
  outwardValue?: number;
  item?: { name?: string; barcode?: string | null };
  locationQtys?: Array<{
    id: string;
    bookQty?: number;
    countedQty?: number | null;
    varianceQty?: number;
    location?: { name?: string };
  }>;
}

export function canSubmitStockReport(role: UserRole | undefined): boolean {
  return role === 'STOREKEEPER' || role === 'ADMIN' || role === 'COST_CONTROL' || role === 'DEPT_MANAGER';
}

export function canApproveStockReport(role: UserRole | undefined): boolean {
  return role === 'FINANCE_MANAGER' || role === 'ADMIN';
}
