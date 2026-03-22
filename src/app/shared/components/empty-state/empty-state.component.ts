import { Component, input } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { Box } from 'lucide-angular';

@Component({
  selector: 'app-empty-state',
  standalone: true,
  imports: [LucideAngularModule],
  template: `
    <div class="empty-state">
      <lucide-icon [img]="boxIcon" [size]="48" class="empty-state__icon" [strokeWidth]="2" />
      <p class="empty-state__title">{{ title() }}</p>
      @if (message()) {
        <p class="empty-state__message">{{ message() }}</p>
      }
    </div>
  `,
  styles: [
    `
      .empty-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 12px;
        padding: 48px 16px;
        text-align: center;
      }

      .empty-state__icon {
        flex-shrink: 0;
        color: rgba(0, 0, 0, 0.2);
      }

      .empty-state__title {
        margin: 0;
        font-size: 15px;
        font-weight: 600;
        color: rgba(0, 0, 0, 0.75);
      }

      .empty-state__message {
        margin: 0;
        font-size: 13px;
        font-weight: 400;
        color: rgba(0, 0, 0, 0.45);
        max-width: 320px;
      }
    `,
  ],
})
export class EmptyStateComponent {
  /** Main heading shown when no data is available */
  readonly title = input.required<string>();

  /** Optional description or hint text */
  readonly message = input<string>('');

  protected readonly boxIcon = Box;
}
