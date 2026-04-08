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
  barcode: string | null;
  description: string | null;
  unitPrice: string | number;
  isActive: boolean;
  imageUrl: string | null;
  department?: { id: string; name: string } | null;
  category?: { id: string; name: string } | null;
  supplier?: { id: string; name: string } | null;
  itemUnits?: Array<{
    unitType: string;
    conversionRate: string | number;
    unit?: { id: string; name: string; abbreviation: string };
  }>;
  stockBalances?: Array<{ qtyOnHand: string | number }>;
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
  /** Backend expects string `'true' | 'false'` or omit for all */
  isActive?: string;
}

export interface ItemsListResult {
  items: ItemListRow[];
  total: number;
}

/** Keys returned when a prerequisite count is zero (`GET /items/check-requirements`). */
export type ItemCreationRequirementKey = 'units' | 'categories' | 'vendors' | 'locations';

/** Why the backend blocks creating/importing items when `canCreateItem` is false. */
export type ItemCreationBlockReason = 'MISSING_PREREQUISITES' | 'OPENING_BALANCE';

/** Response `data` from `GET /items/check-requirements` (tenant-scoped prerequisites). */
export interface RequirementsResponse {
  canCreateItem: boolean;
  requirements: {
    units: { count: number };
    categories: { count: number };
    vendors: { count: number };
    locations: { count: number };
  };
  /** Present when `canCreateItem` is false (see backend `GET /items/check-requirements`). */
  blockReason?: ItemCreationBlockReason;
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
  isActive?: boolean;
  imageUrl?: string | null;
  itemUnits?: ItemUnitRow[];
}
