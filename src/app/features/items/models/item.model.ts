import type { ApiResponse } from '../../../core/models/api-response.model';

/** Unit row returned from `GET /items/:id/units` or embedded on item payloads. */
export interface ItemUnitRow {
  unitId: string;
  unitType: 'BASE' | 'PURCHASE' | 'ISSUE';
  conversionRate: number;
}

/** Row shape from `GET /items` (list). Barcode doubles as SKU in the UI, matching the React app. */
export interface ItemListRow {
  id: string;
  name: string;
  /** Item code / SKU when present on the API payload */
  code?: string | null;
  barcode: string | null;
  description: string | null;
  unitPrice: string | number;
  isActive: boolean;
  imageUrl: string | null;
  department?: { id: string; name: string } | null;
  category?: { id: string; name: string } | null;
  /** Populated on item detail (`GET /items/:id`) when API includes nested subcategory. */
  subcategory?: { id: string; name: string } | null;
  supplier?: { id: string; name: string } | null;
  itemUnits?: Array<{
    unitType: string;
    conversionRate: string | number;
    unit?: { id: string; name: string; abbreviation: string };
  }>;
  stockBalances?: Array<{ qtyOnHand: string | number }>;
  /** Qty on hand at the warehouse requested by `GET /inventory/items-by-locations/:locationId` */
  currentStock?: number;
  /**
   * Draft opening balance from API during OB OPEN (`GET /items`, `GET /items/:id`).
   */
  openingQuantity?: string | number | null;
  /** @deprecated Backend may still send during migration; valuation uses `unitPrice` during OB OPEN. */
  openingUnitCost?: string | number | null;
  /**
   * During OB OPEN: sum of DRAFT OPENING_BALANCE line qty (all locations).
   * After finalize: same as on-hand total from stock balances.
   */
  displayTotalQty?: string | number | null;
  /**
   * Optional legacy names; prefer `openingQuantity`. Draft unit cost is deprecated in favor of catalog `unitPrice`.
   */
  openingBalanceDraftQty?: string | number | null;
  /** @deprecated Prefer `unitPrice` for OB valuation. */
  openingBalanceDraftUnitCost?: string | number | null;
}

export interface ItemDetail extends ItemListRow {
  departmentId?: string | null;
  categoryId?: string | null;
  subcategoryId?: string | null;
  supplierId?: string | null;
  defaultStoreId?: string | null;
  reorderPoint?: number;
  reorderQty?: number;
}

/** Query params for `itemsAPI.list` / `GET /items`. */
export interface ItemsListParams {
  skip?: number;
  take?: number;
  search?: string;
  categoryId?: string;
  departmentId?: string;
  locationId?: string;
  /** Master catalog mode when supported by the API */
  catalog?: boolean;
  /** Lighter list payload when supported by the API */
  slim?: boolean;
  /** Backend accepts boolean or `'true' | 'false'`; omit for all */
  isActive?: boolean | string;
}

export interface ItemsListResult {
  items: ItemListRow[];
  total: number;
}

/** Keys returned when a prerequisite count is zero (`GET /items/check-requirements`). */
export type ItemCreationRequirementKey =
  | 'departments'
  | 'units'
  | 'categories'
  | 'vendors'
  | 'locations';

/** Why the backend blocks creating/importing items when `canCreateItem` is false. */
export type ItemCreationBlockReason = 'MISSING_PREREQUISITES' | 'OPENING_BALANCE';

/** Response `data` from `GET /items/check-requirements` (tenant-scoped prerequisites). */
export interface RequirementsResponse {
  /**
   * True when departments, units, categories, suppliers (vendors), and locations
   * each have at least one row (tenant-scoped).
   */
  canCreateItem: boolean;
  requirements: {
    departments: { count: number };
    units: { count: number };
    categories: { count: number };
    vendors: { count: number };
    locations: { count: number };
  };
  /** Present when `canCreateItem` is false (see backend `GET /items/check-requirements`). */
  blockReason?: ItemCreationBlockReason;
  /**
   * Tenant OB stage: `true` when Initial Setup is OPEN (OB not finalized). Drives banners only on Item Master / import — not whether Add/Import is enabled (`canCreateItem` gates actions).
   */
  isOpeningBalanceAllowed: boolean;
  /**
   * Explicit Opening Balance lifecycle status from backend.
   * - OPEN: setup active
   * - INITIAL_LOCK: initial setup must be enabled first
   * - FINALIZED: production mode, OB flow finalized
   */
  obStatus?: 'OPEN' | 'INITIAL_LOCK' | 'FINALIZED';
}

/** Quick-link routes for each prerequisite (top-level app routes). */
export const ITEM_CREATION_REQUIREMENT_ROUTES: Record<ItemCreationRequirementKey, string> = {
  departments: '/departments',
  units: '/units-manage',
  categories: '/categories',
  vendors: '/suppliers',
  locations: '/locations',
};

/** Which master-data rows are missing (count === 0) for item creation. */
export function getMissingItemCreationRequirements(
  r: RequirementsResponse['requirements'],
): ItemCreationRequirementKey[] {
  const missing: ItemCreationRequirementKey[] = [];
  if (r.departments.count === 0) {
    missing.push('departments');
  }
  if (r.units.count === 0) {
    missing.push('units');
  }
  if (r.categories.count === 0) {
    missing.push('categories');
  }
  if (r.vendors.count === 0) {
    missing.push('vendors');
  }
  if (r.locations.count === 0) {
    missing.push('locations');
  }
  return missing;
}

export interface CategoryOption {
  id: string;
  name: string;
  subcategories?: SubcategoryOption[];
}

export interface SubcategoryOption {
  id: string;
  name: string;
}

export interface UnitOption {
  id: string;
  name: string;
  abbreviation: string;
}

export interface SupplierOption {
  id: string;
  name: string;
}

export interface DepartmentOption {
  id: string;
  name: string;
}

export interface LocationOption {
  id: string;
  name: string;
  departmentId: string | null;
}

export interface ItemImportPreviewData {
  preview: ItemImportPreviewRow[];
  filePath: string;
  total?: number;
  valid?: number;
  invalid?: number;
  storeColumns?: string[];
  unknownColumns?: string[];
  [key: string]: unknown;
}

export type ItemImportPreviewResponse = ApiResponse<ItemImportPreviewData>;

export interface ItemImportPreviewRow {
  rowNum: number;
  status: 'VALID' | 'ERROR' | string;
  errors?: string[];
  issues?: ItemImportIssue[];
  data: {
    name?: string;
    barcode?: string;
    deptName?: string;
    categoryName?: string;
    /** Alternate key some APIs use for resolved category label */
    category?: string;
    vendorName?: string;
    vendor?: string;
    supplierName?: string;
    baseUnitName?: string;
    baseUnit?: string;
    unitName?: string;
    unitPrice?: number | string;
    storeQuantities?: Record<string, number | string>;
    [key: string]: unknown;
  };
}

export interface ItemImportIssue {
  field?: string;
  message: string;
  code?: string;
  severity?: 'error' | 'warning' | string;
}

export interface ItemImportFailureRow {
  rowNum: number;
  errors?: string[];
}

export interface ItemImportResult {
  inserted: number;
  updated: number;
  failed: number;
  obCount?: number;
  obDocuments?: string[];
  failures?: ItemImportFailureRow[];
}

/** Body for `POST /items` and `PUT /items/:id` — aligns with React `ItemFormModal` submit payload. */
export interface ItemPayload {
  name: string;
  barcode?: string | null;
  description?: string | null;
  departmentId?: string | null;
  categoryId?: string | null;
  subcategoryId?: string | null;
  supplierId?: string | null;
  defaultStoreId?: string | null;
  unitPrice: number;
  /**
   * Sent on `POST /items` during OB setup when the form shows opening quantity (mirrors Opening quantity input).
   */
  openingQuantity?: number;
  isActive?: boolean;
  imageUrl?: string | null;
  itemUnits?: ItemUnitRow[];
}
