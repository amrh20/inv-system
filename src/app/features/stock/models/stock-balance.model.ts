/** Row from `GET /stock-balances` (shape follows Prisma relations). */
export interface StockBalanceItemNested {
  name: string;
  barcode?: string | null;
  reorderPoint?: string | number | null;
  department?: { id: string; name: string } | null;
  category?: { id: string; name: string } | null;
}

export interface StockBalanceLocationNested {
  id: string;
  name: string;
}

export interface StockBalanceRow {
  itemId: string;
  locationId: string;
  qtyOnHand: string | number;
  wacUnitCost?: string | number;
  item?: StockBalanceItemNested | null;
  location?: StockBalanceLocationNested | null;
}

export interface StockBalancesParams {
  take?: number;
  /** Offset for paginated `GET /stock-balances` (with `take`). */
  skip?: number;
  search?: string;
  locationId?: string;
  categoryId?: string;
  departmentId?: string;
  /** Backend: `'true' | 'false'` */
  showZero?: string;
}

export interface StockBalancesListResult {
  balances: StockBalanceRow[];
  total: number;
}

export interface StockBalancesSummary {
  totalValue?: string | number;
  totalItems?: string | number;
  totalQty?: string | number;
  lowStockCount?: string | number;
  zeroStockCount?: string | number;
}

export type StockReorderStatus = 'in_stock' | 'low_stock' | 'out_of_stock';
