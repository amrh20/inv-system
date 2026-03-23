import { Component, input } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

/** Row shape from backend detail report */
export interface DetailReportRow {
  category?: string;
  itemCode?: string;
  itemName?: string;
  unitPrice?: number;
  openingQty?: number;
  openingValue?: number;
  inwardQty?: number;
  inwardValue?: number;
  breakageQty?: number;
  gatePassQty?: number;
  theoreticalQty?: number;
  theoreticalValue?: number;
  physicalQty?: number;
  varianceQty?: number;
  varianceValue?: number;
  closingQty?: number;
  closingValue?: number;
  locationQtys?: Record<string, number>;
}

@Component({
  selector: 'app-detail-report-table',
  standalone: true,
  imports: [TranslatePipe],
  templateUrl: './detail-report-table.component.html',
  styleUrl: './detail-report-table.component.scss',
})
export class DetailReportTableComponent {
  readonly rows = input<DetailReportRow[]>([]);
  readonly locations = input<{ id: string; name: string }[]>([]);

  fmt(n: unknown): string {
    return Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  fmtQty(n: unknown): string {
    return Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 4 });
  }

  locQty(row: DetailReportRow, locId: string): string {
    return this.fmtQty(row.locationQtys?.[locId] ?? 0);
  }
}
