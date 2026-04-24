import { Component, computed, inject, input } from '@angular/core';
import { NzTimelineModule } from 'ng-zorro-antd/timeline';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import type { ReturnsAccountabilityType } from '../../models/returns-accountability.model';
import {
  isHighlightedTimelineStep,
  workflowApprovalTimeline,
  type ReturnsWorkflowDocumentContext,
  type WorkflowTimelineEntry,
} from '../../utils/returns-workflow.helpers';

@Component({
  selector: 'app-returns-workflow-timeline',
  standalone: true,
  imports: [NzTimelineModule, TranslatePipe],
  templateUrl: './returns-workflow-timeline.component.html',
  styleUrl: './returns-workflow-timeline.component.scss',
})
export class ReturnsWorkflowTimelineComponent {
  private readonly translate = inject(TranslateService);

  /** Document payload (breakage / lost detail, or modal context). */
  readonly documentContext = input<ReturnsWorkflowDocumentContext | null>(null);
  /** When true, only APPROVED steps (compact modal history). */
  readonly approvedOnly = input(false);
  /** i18n key when there is nothing to show. */
  readonly emptyMessageKey = input('RETURNS_WORKFLOW.NO_WORKFLOW_HISTORY');

  readonly entries = computed(() => {
    const rows = workflowApprovalTimeline(this.documentContext() ?? {});
    return this.approvedOnly() ? rows.filter((e) => e.status === 'APPROVED') : rows;
  });

  readonly hasRows = computed(() => this.entries().length > 0);

  isHighlighted(entry: WorkflowTimelineEntry): boolean {
    const ctx = this.documentContext();
    if (!ctx) return false;
    return isHighlightedTimelineStep(entry, ctx);
  }

  roleLabelKey(roleCode: string): string {
    return `COMMON.ROLES.${roleCode}`;
  }

  displayRole(roleCode: string): string {
    const key = this.roleLabelKey(roleCode);
    const t = this.translate.instant(key);
    return t !== key ? t : roleCode;
  }

  accountabilityOptionKey(t: ReturnsAccountabilityType | null): string {
    switch (t) {
      case 'EMPLOYEE_DEDUCTION':
        return 'BREAKAGE.CREATE.EMPLOYEE_DEDUCTION';
      case 'COMPANY_LOSS':
        return 'BREAKAGE.CREATE.HOTEL_BUDGET';
      case 'TARGET_HOTEL_COMPENSATION':
        return 'GET_PASS.DETAIL.ACCOUNTABILITY_TARGET_COMPENSATION';
      default:
        return 'RETURNS_WORKFLOW.ACCOUNTABILITY_NOT_RECORDED';
    }
  }

  /** Action column: accountability when approved; status otherwise. */
  actionLabel(entry: WorkflowTimelineEntry): string {
    if (entry.status === 'PENDING') return this.translate.instant('RETURNS_WORKFLOW.TIMELINE_ACTION_PENDING');
    if (entry.status === 'REJECTED') return this.translate.instant('RETURNS_WORKFLOW.TIMELINE_ACTION_REJECTED');
    if (entry.status === 'APPROVED') {
      const base = this.translate.instant(this.accountabilityOptionKey(entry.accountabilityType));
      if (entry.accountabilityType === 'EMPLOYEE_DEDUCTION' && entry.accountabilityEmployeeName) {
        return `${base} (${entry.accountabilityEmployeeName})`;
      }
      return base;
    }
    return this.translate.instant('RETURNS_WORKFLOW.TIMELINE_ACTION_OTHER');
  }

  timelineColor(entry: WorkflowTimelineEntry): string {
    if (entry.status === 'APPROVED') return 'green';
    if (entry.status === 'REJECTED') return 'red';
    if (entry.status === 'PENDING') return 'blue';
    return 'gray';
  }
}
