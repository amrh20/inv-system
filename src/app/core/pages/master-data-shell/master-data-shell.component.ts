import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

/** Minimal shell so `/master-data/*` can host redirect routes to real master-data pages. */
@Component({
  standalone: true,
  selector: 'app-master-data-shell',
  imports: [RouterOutlet],
  template: '<router-outlet />',
})
export class MasterDataShellComponent {}
