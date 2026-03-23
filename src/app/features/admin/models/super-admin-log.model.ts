export interface SuperAdminLogRow {
  id: string;
  action: string;
  targetTenantId: string | null;
  details: unknown;
  createdAt: string;
  adminUser?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  } | null;
  targetTenant?: {
    id: string;
    name: string;
    slug?: string;
  } | null;
}
