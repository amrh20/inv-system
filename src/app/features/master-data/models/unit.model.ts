/** Unit list row — aligns with Prisma Unit. */
export interface UnitRow {
  id: string;
  name: string;
  abbreviation: string;
  description?: string | null;
  isActive: boolean;
}

/** Create/update payload for Unit. */
export interface UnitPayload {
  name: string;
  abbreviation: string;
  description?: string | null;
}
