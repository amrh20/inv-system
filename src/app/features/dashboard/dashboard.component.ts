import { Component } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [TranslatePipe],
  template: `
    <h1>{{ 'NAV.DASHBOARD' | translate }}</h1>
    <p>{{ 'DASHBOARD.PLACEHOLDER' | translate }}</p>
  `,
})
export class DashboardComponent {}
