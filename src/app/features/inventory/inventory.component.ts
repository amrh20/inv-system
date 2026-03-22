import { Component } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

@Component({
  selector: 'app-inventory',
  standalone: true,
  imports: [TranslatePipe],
  template: `
    <h1>{{ 'NAV.INVENTORY' | translate }}</h1>
    <p>{{ 'INVENTORY.PLACEHOLDER' | translate }}</p>
  `,
})
export class InventoryComponent {}
