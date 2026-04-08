import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

/** Hosts `/inventory` and nested routes such as `/inventory/items/import`. */
@Component({
  selector: 'app-inventory-layout',
  standalone: true,
  imports: [RouterOutlet],
  template: '<router-outlet />',
})
export class InventoryLayoutComponent {}
