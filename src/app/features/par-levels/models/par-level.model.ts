import type {
  StockBalanceItemNested,
  StockBalanceLocationNested,
} from '../../stock/models/stock-balance.model';

/** Par level row from `GET /par-levels` — StockBalance with min/max/reorder. */
export interface ParLevelRow {
  itemId: string;
  locationId: string;
  qtyOnHand: string | number;
  minQty: string | number;
  maxQty: string | number;
  reorderPoint: string | number;
  wacUnitCost?: string | number;
  item?: StockBalanceItemNested | null;
  location?: StockBalanceLocationNested | null;
}

/** Single update payload for `PUT /par-levels`. */
export interface ParLevelUpdate {
  itemId: string;
  locationId: string;
  minQty?: number;
  maxQty?: number;
  reorderPoint?: number;
}

/** Low-stock item from `GET /par-levels/low-stock`. */
export interface LowStockItem {
  itemId: string;
  locationId: string;
  qtyOnHand: string | number;
  minQty: string | number;
  maxQty: string | number;
  reorderPoint: string | number;
  item?: { id: string; name: string; barcode?: string | null } | null;
  location?: { id: string; name: string } | null;
}
