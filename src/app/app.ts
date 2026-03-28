import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { LanguageService } from './core/services/language.service';
import { SubscriptionExpiredOverlayComponent } from './shared/components/subscription-expired-overlay/subscription-expired-overlay.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, SubscriptionExpiredOverlayComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  // Ensures saved language and document direction are applied on app bootstrap.
  private readonly _language = inject(LanguageService);
}
