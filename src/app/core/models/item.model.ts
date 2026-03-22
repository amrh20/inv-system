/**
 * Item model (M02 — Item Master)
 */
export interface Item {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  departmentId: string | null;
  categoryId: string | null;
  subcategoryId: string | null;
  supplierId: string | null;
  defaultStoreId: string | null;
  barcode: string | null;
  code: string | null;
  unitPrice: number;
  imageUrl: string | null;
  reorderPoint: number;
  reorderQty: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}
