import { type CanDeactivateFn } from '@angular/router';
import { GrnCreateComponent } from './grn-create.component';

export const grnCreateCanDeactivateGuard: CanDeactivateFn<GrnCreateComponent> = (component) =>
  component.confirmDeactivate();
