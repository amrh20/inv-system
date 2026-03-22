/** Supplier list row — aligns with Prisma Supplier. */
export interface SupplierRow {
  id: string;
  name: string;
  contactPerson?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  isActive: boolean;
}

/** Create/update payload for Supplier. */
export interface SupplierPayload {
  name: string;
  contactPerson?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
}
