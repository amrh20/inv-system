import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { Lock, LucideAngularModule } from 'lucide-angular';

@Component({
  selector: 'app-forbidden',
  standalone: true,
  imports: [RouterLink, TranslatePipe, NzButtonModule, LucideAngularModule],
  templateUrl: './forbidden.component.html',
})
export class ForbiddenComponent {
  readonly lucideLock = Lock;
}
