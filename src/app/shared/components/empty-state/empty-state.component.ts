import { Component, input } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { BarChart3, Box } from 'lucide-angular';

/** Icons supported by `icon` input (extend when needed) */
export type EmptyStateIcon = typeof Box | typeof BarChart3;

@Component({
  selector: 'app-empty-state',
  standalone: true,
  imports: [LucideAngularModule],
  template: `
    <div class="empty-state">
      <lucide-icon [img]="icon()" [size]="iconSize()" class="empty-state__icon" [strokeWidth]="2" />
      <p class="empty-state__title">{{ title() }}</p>
      @if (message()) {
        <p class="empty-state__message" [class.empty-state__message--caption]="messageTone() === 'caption'">
          {{ message() }}
        </p>
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

      .empty-state__message--caption {
        font-size: 0.75rem;
        line-height: 1.5;
        color: #94a3b8;
        max-width: 28rem;
      }
    `,
  ],
})
export class EmptyStateComponent {
  /** Main heading shown when no data is available */
  readonly title = input.required<string>();

  /** Optional description or hint text */
  readonly message = input<string>('');

  /** Lucide icon (default: Box) */
  readonly icon = input<EmptyStateIcon>(Box);

  /** Icon size in px */
  readonly iconSize = input(48);

  /** Use smaller, muted styling for secondary hint lines */
  readonly messageTone = input<'default' | 'caption'>('default');
}
