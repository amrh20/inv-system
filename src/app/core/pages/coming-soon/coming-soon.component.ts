import { Component, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { NavigationService } from '../../services/navigation.service';

@Component({
  selector: 'app-coming-soon',
  standalone: true,
  imports: [TranslatePipe],
  template: `
    <h1>{{ pageTitle | translate }}</h1>
    <p>{{ 'COMMON.SCREEN_NOT_BUILT_YET' | translate }}</p>
  `,
})
export class ComingSoonComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly nav = inject(NavigationService);

  get pageTitle(): string {
    const fromData = this.route.snapshot.data['breadcrumb'];
    if (typeof fromData === 'string' && fromData.length) {
      return fromData;
    }
    const url = this.router.url.split('?')[0];
    return this.nav.breadcrumbLabelForPath(url) ?? 'COMMON.PAGE';
  }
}
