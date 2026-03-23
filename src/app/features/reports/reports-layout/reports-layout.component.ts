import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { LucideAngularModule } from 'lucide-angular';
import {
  AlertTriangle,
  ArrowLeftRight,
  ArrowRightLeft,
  BarChart3,
  Clock,
  Coins,
  FileSpreadsheet,
} from 'lucide-angular';

@Component({
  selector: 'app-reports-layout',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, TranslatePipe, LucideAngularModule],
  templateUrl: './reports-layout.component.html',
  styleUrl: './reports-layout.component.scss',
})
export class ReportsLayoutComponent {
  readonly lucideSummary = BarChart3;
  readonly lucideDetail = FileSpreadsheet;
  readonly lucideBreakage = AlertTriangle;
  readonly lucideOmc = ArrowLeftRight;
  readonly lucideTransfers = ArrowRightLeft;
  readonly lucideAging = Clock;
  readonly lucideValuation = Coins;

  readonly tabs = [
    { path: '/reports/summary', labelKey: 'REPORTS.TABS.SUMMARY', icon: 'summary' as const },
    { path: '/reports/detail', labelKey: 'REPORTS.TABS.DETAIL', icon: 'detail' as const },
    { path: '/reports/breakage', labelKey: 'REPORTS.TABS.BREAKAGE', icon: 'breakage' as const },
    { path: '/reports/omc', labelKey: 'REPORTS.TABS.OMC', icon: 'omc' as const },
    { path: '/reports/transfers', labelKey: 'REPORTS.TABS.TRANSFERS', icon: 'transfers' as const },
    { path: '/reports/aging', labelKey: 'REPORTS.TABS.AGING', icon: 'aging' as const },
    { path: '/reports/valuation', labelKey: 'REPORTS.TABS.VALUATION', icon: 'valuation' as const },
  ];
}
