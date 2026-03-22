import type { LocationType } from '../../../core/models/enums';

/** Location list row — aligns with Prisma Location. */
export interface LocationRow {
  id: string;
  name: string;
  type: LocationType;
  description?: string | null;
  departmentId?: string | null;
  department?: { id: string; name: string; code?: string } | null;
  isActive: boolean;
  /** Counts from API (when include _count) */
  _count?: {
    locationUsers?: number;
    defaultItems?: number;
  };
}

/** Create/update payload for Location. */
export interface LocationPayload {
  name: string;
  type?: LocationType;
  description?: string | null;
  departmentId: string | null;
}
