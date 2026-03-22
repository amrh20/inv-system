/** Department list row — aligns with Prisma Department. */
export interface DepartmentRow {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
  _count?: { locations: number; items: number };
}

/** Create/update payload for Department. */
export interface DepartmentPayload {
  name: string;
  code: string;
}
