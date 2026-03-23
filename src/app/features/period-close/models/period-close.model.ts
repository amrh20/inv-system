export type PeriodCloseStatus = 'CLOSED' | 'OPEN';

export interface PeriodCloseRow {
  id: string;
  year: number;
  month?: number | null;
  status: PeriodCloseStatus;
  closedAt?: string | null;
  notes?: string | null;
}
