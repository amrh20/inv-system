import { inject, Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import type {
  LedgerEntryRow,
  MovementDirectionFilter,
  MovementsListParams,
  MovementsListResult,
} from '../../ledger/models/ledger-entry.model';
import { LedgerService } from '../../ledger/services/ledger.service';

/** When filtering by synthetic IN/OUT/TRANSFER, fetch up to this many rows then filter client-side. */
const DIRECTION_FILTER_CAP = 5000;

@Injectable({ providedIn: 'root' })
export class MovementsService {
  private readonly ledger = inject(LedgerService);

  list(params: MovementsListParams): Observable<MovementsListResult> {
    const type: MovementDirectionFilter = params.type ?? '';
    const useCap = !!type;
    const take = useCap ? DIRECTION_FILTER_CAP : (params.take ?? 100);
    const skip = useCap ? 0 : (params.skip ?? 0);

    return this.ledger
      .list({
        skip,
        take,
        itemId: params.itemId,
        locationId: params.locationId,
        dateFrom: params.dateFrom,
        dateTo: params.dateTo,
      })
      .pipe(
        map((res) => {
          const filtered = type ? res.entries.filter((e) => matchesMovementDirection(e, type)) : res.entries;
          const total = type ? filtered.length : res.total;
          return {
            rows: filtered,
            total,
            capped: useCap && res.entries.length >= DIRECTION_FILTER_CAP,
          };
        }),
      );
  }
}

function matchesMovementDirection(row: LedgerEntryRow, type: MovementDirectionFilter): boolean {
  if (!type) {
    return true;
  }
  const qtyIn = Number(row.qtyIn);
  const qtyOut = Number(row.qtyOut);
  const mt = row.movementType;
  if (type === 'TRANSFER') {
    return mt === 'TRANSFER_IN' || mt === 'TRANSFER_OUT';
  }
  if (type === 'IN') {
    return qtyIn > 0;
  }
  if (type === 'OUT') {
    return qtyOut > 0;
  }
  return true;
}
