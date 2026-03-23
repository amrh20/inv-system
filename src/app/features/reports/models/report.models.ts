/** Unified report document returned by POST /reports/generate */
export type EngineReportType = 'DETAIL' | 'BREAKAGE' | 'OMC' | 'TRANSFERS' | 'AGING';

export interface GeneratedReport {
  id: string;
  reportName: string;
  reportType: EngineReportType | string;
  startDate: string;
  endDate: string;
  createdAt: string;
  data: {
    rows: unknown[];
    locations?: { id: string; name: string }[];
  };
}

export interface SummaryInventoryRow {
  label: string;
  openQty?: number | null;
  openVal?: number | null;
  grnQty?: number | null;
  grnVal?: number | null;
  brkQty?: number | null;
  brkVal?: number | null;
  passQty?: number | null;
  passVal?: number | null;
  theorQty?: number | null;
  theorVal?: number | null;
  physQty?: number | null;
  physVal?: number | null;
  varQty?: number | null;
  varVal?: number | null;
  closeQty?: number | null;
  closeVal?: number | null;
  [key: string]: unknown;
}

export interface SummaryInventoryTotals extends Record<string, number | null | undefined> {
  varianceRatio?: number;
}

export interface SummaryInventoryPayload {
  rows: SummaryInventoryRow[];
  totals?: SummaryInventoryTotals | null;
  period?: { startDate: string; endDate: string };
  hasPhysical?: boolean;
}

export interface ValuationRow {
  department?: string;
  location?: string;
  category?: string;
  itemName?: string;
  itemCode?: string;
  qty?: number;
  unitCost?: number;
  value?: number;
  [key: string]: unknown;
}

export interface ValuationPayload {
  rows: ValuationRow[];
  totalValue?: number;
  snapshotUsed?: string | null;
}
