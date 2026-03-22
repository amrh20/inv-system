/** Category list row — aligns with Prisma Category. */
export interface CategoryRow {
  id: string;
  name: string;
  description?: string | null;
  departmentId?: string | null;
  department?: { id: string; name: string } | null;
  isActive: boolean;
  subcategories?: SubcategoryRow[];
}

/** Subcategory — aligns with Prisma Subcategory. */
export interface SubcategoryRow {
  id: string;
  name: string;
  description?: string | null;
  categoryId: string;
  isActive: boolean;
}

/** Create/update payload for Category. */
export interface CategoryPayload {
  name: string;
  description?: string | null;
  departmentId?: string | null;
}

/** Create/update payload for Subcategory. */
export interface SubcategoryPayload {
  name: string;
  description?: string | null;
}
