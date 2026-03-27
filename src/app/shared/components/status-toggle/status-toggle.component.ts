import { Component, computed, effect, input, output, signal } from '@angular/core';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';

@Component({
  selector: 'app-status-toggle',
  standalone: true,
  imports: [NzSwitchModule, FormsModule, TranslatePipe],
  template: `
    <div class="status-toggle">
      <span class="status-toggle__label" [class.status-toggle__label--active]="displayStatus()">
        {{ displayStatus() ? ('COMMON.ACTIVE' | translate) : ('COMMON.INACTIVE' | translate) }}
      </span>
      <nz-switch
        [ngModel]="displayStatus()"
        [nzDisabled]="disabled()"
        [nzControl]="true"
        (click)="onSwitchClick()"
        [nzCheckedChildren]="checkedTpl"
        [nzUnCheckedChildren]="uncheckedTpl"
      />
      <ng-template #checkedTpl>
        <span class="status-toggle__switch-text status-toggle__switch-text--on">{{ 'COMMON.ON' | translate }}</span>
      </ng-template>
      <ng-template #uncheckedTpl>
        <span class="status-toggle__switch-text status-toggle__switch-text--off">{{ 'COMMON.OFF' | translate }}</span>
      </ng-template>
    </div>
  `,
  styles: [
    `
      .status-toggle {
        display: inline-flex;
        align-items: center;
        gap: 8px;
      }

      .status-toggle__label {
        font-size: 12px;
        color: rgba(0, 0, 0, 0.45);
      }

      .status-toggle__label--active {
        color: var(--color-brand-success, #52c41a);
        font-weight: 500;
      }

      .status-toggle__switch-text {
        font-size: 11px;
      }

      .status-toggle__switch-text--on {
        color: #fff;
      }

      .status-toggle__switch-text--off {
        color: rgba(0, 0, 0, 0.45);
      }

      :host ::ng-deep .ant-switch-checked {
        background: var(--color-brand-success, #52c41a) !important;
      }

      :host ::ng-deep .ant-switch:not(.ant-switch-checked) {
        background: rgba(0, 0, 0, 0.25) !important;
      }
    `,
  ],
})
export class StatusToggleComponent {
  /** Current status (true = Active, false = Inactive). Accepts boolean or status string. */
  readonly status = input<boolean | string>(false);
  /** Prevent interaction while parent operation is pending. */
  readonly disabled = input(false);

  readonly statusChange = output<boolean>();

  readonly resolvedStatus = computed(() => {
    const s = this.status();
    if (typeof s === 'boolean') return s;
    const str = String(s || '').toLowerCase();
    return str === 'active' || str === 'true' || str === '1';
  });

  /**
   * Display state: only updates when the parent's status input changes.
   * This prevents the toggle from visually changing when the user clicks
   * until the parent confirms (e.g. after a confirmation dialog).
   */
  protected readonly displayStatus = signal(false);

  constructor() {
    effect(() => {
      this.displayStatus.set(this.resolvedStatus());
    });
  }

  onChange(value: boolean): void {
    this.statusChange.emit(value);
  }

  onSwitchClick(): void {
    if (this.disabled()) {
      return;
    }
    this.statusChange.emit(!this.displayStatus());
  }
}
