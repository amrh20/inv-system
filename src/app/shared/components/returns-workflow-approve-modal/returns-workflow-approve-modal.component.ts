import { Component, effect, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzRadioModule } from 'ng-zorro-antd/radio';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import type { ReturnsAccountabilityType } from '../../models/returns-accountability.model';
import { ReturnsWorkflowTimelineComponent } from '../returns-workflow-timeline/returns-workflow-timeline.component';
import type { ReturnsWorkflowDocumentContext } from '../../utils/returns-workflow.helpers';

@Component({
  selector: 'app-returns-workflow-approve-modal',
  standalone: true,
  imports: [
    FormsModule,
    NzButtonModule,
    NzModalModule,
    NzRadioModule,
    ReturnsWorkflowTimelineComponent,
    TranslatePipe,
  ],
  templateUrl: './returns-workflow-approve-modal.component.html',
  styleUrl: './returns-workflow-approve-modal.component.scss',
})
export class ReturnsWorkflowApproveModalComponent {
  private readonly translate = inject(TranslateService);
  private readonly message = inject(NzMessageService);

  readonly open = input(false);
  readonly contextLoading = input(false);
  readonly submitting = input(false);
  /** Loaded document (GET detail) so workflow history can render before the user acts. */
  readonly documentContext = input<ReturnsWorkflowDocumentContext | null>(null);

  readonly closed = output<void>();
  readonly submitted = output<ReturnsAccountabilityType>();

  readonly accountability = signal<ReturnsAccountabilityType | null>(null);

  readonly accountabilityOptions: ReturnsAccountabilityType[] = [
    'EMPLOYEE_DEDUCTION',
    'COMPANY_LOSS',
    'TARGET_HOTEL_COMPENSATION',
  ];

  constructor() {
    effect(() => {
      if (this.open()) {
        this.accountability.set(null);
      }
    });
  }

  onCancel(): void {
    if (this.submitting()) return;
    this.closed.emit();
  }

  onSubmit(): void {
    const v = this.accountability();
    if (!v) {
      this.message.warning(this.translate.instant('RETURNS_WORKFLOW.ACCOUNTABILITY_REQUIRED'));
      return;
    }
    this.submitted.emit(v);
  }

  optionLabelKey(v: ReturnsAccountabilityType): string {
    switch (v) {
      case 'EMPLOYEE_DEDUCTION':
        return 'GET_PASS.DETAIL.ACCOUNTABILITY_EMPLOYEE_DEDUCTION';
      case 'COMPANY_LOSS':
        return 'GET_PASS.DETAIL.ACCOUNTABILITY_COMPANY_LOSS';
      case 'TARGET_HOTEL_COMPENSATION':
        return 'GET_PASS.DETAIL.ACCOUNTABILITY_TARGET_COMPENSATION';
      default:
        return 'GET_PASS.DETAIL.ACCOUNTABILITY';
    }
  }

  canSubmit(): boolean {
    return this.accountability() !== null && !this.submitting() && !this.contextLoading();
  }
}
