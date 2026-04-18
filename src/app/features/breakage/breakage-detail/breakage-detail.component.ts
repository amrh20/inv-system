import { DatePipe, NgClass } from '@angular/common';
import {
  Component,
  DestroyRef,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { environment } from '../../../../environments/environment';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzRadioModule } from 'ng-zorro-antd/radio';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { LucideAngularModule } from 'lucide-angular';
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  Download,
  FileText,
  Paperclip,
  ShieldAlert,
  Trash2,
  XCircle,
} from 'lucide-angular';
import { HasPermissionDirective } from '../../../core/directives/has-permission.directive';
import { AuthService } from '../../../core/services/auth.service';
import { ConfirmationService } from '../../../core/services/confirmation.service';
import { ReturnsWorkflowApproveModalComponent } from '../../../shared/components/returns-workflow-approve-modal/returns-workflow-approve-modal.component';
import { ReturnsWorkflowTimelineComponent } from '../../../shared/components/returns-workflow-timeline/returns-workflow-timeline.component';
import type { ReturnsAccountabilityType } from '../../../shared/models/returns-accountability.model';
import {
  pendingApprovalStepFromContext,
  requiredRoleCodeFromStep,
  userMatchesCurrentApprovalChainStep,
  WORKFLOW_PERMISSION_APPROVE_BREAKAGE,
} from '../../../shared/utils/returns-workflow.helpers';
import type { BreakageAttachmentMeta, BreakageDetail, BreakageWorkflowStatus } from '../models/breakage.model';
import { BreakageService } from '../services/breakage.service';

@Component({
  selector: 'app-breakage-detail',
  standalone: true,
  providers: [ConfirmationService],
  imports: [
    DatePipe,
    NgClass,
    FormsModule,
    NzAlertModule,
    NzButtonModule,
    NzInputModule,
    NzModalModule,
    NzTableModule,
    NzRadioModule,
    TranslatePipe,
    LucideAngularModule,
    HasPermissionDirective,
    ReturnsWorkflowTimelineComponent,
    ReturnsWorkflowApproveModalComponent,
  ],
  templateUrl: './breakage-detail.component.html',
  styleUrl: './breakage-detail.component.scss',
})
export class BreakageDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly api = inject(BreakageService);
  private readonly auth = inject(AuthService);
  private readonly confirmation = inject(ConfirmationService);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);

  readonly lucideBack = ArrowLeft;
  readonly lucideCheck = CheckCircle2;
  readonly lucideX = XCircle;
  readonly lucideClock = Clock;
  readonly lucideFile = FileText;
  readonly lucideClip = Paperclip;
  readonly lucideShield = ShieldAlert;
  readonly lucideTrash = Trash2;
  readonly lucideDownload = Download;

  readonly doc = signal<BreakageDetail | null>(null);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly actionBusy = signal(false);
  readonly uploadBusy = signal(false);
  /** Internal / non–get-pass breakage: combined approve–reject modal. */
  readonly approvalOpen = signal(false);
  readonly approvalAction = signal<'APPROVE' | 'REJECT'>('APPROVE');
  readonly approvalComment = signal('');
  /** Unified workflow (get-pass returns or approval chain): accountability modal. */
  readonly returnsWorkflowOpen = signal(false);
  readonly returnsWorkflowSubmitting = signal(false);
  /** Unified workflow: reject with comment. */
  readonly rejectModalOpen = signal(false);
  readonly rejectComment = signal('');

  readonly attachments = signal<BreakageAttachmentMeta[]>([]);

  readonly serverOrigin = environment.apiUrl.replace(/\/api\/?$/, '');

  readonly permApproveBreakage = WORKFLOW_PERMISSION_APPROVE_BREAKAGE;

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.error.set(this.translate.instant('BREAKAGE.DETAIL.NOT_FOUND'));
      this.loading.set(false);
      return;
    }
    this.fetch(id);
  }

  back(): void {
    this.router.navigate(['/breakage']);
  }

  private parseAttachments(doc: BreakageDetail): BreakageAttachmentMeta[] {
    if (!doc.attachmentUrl) return [];
    try {
      const raw = JSON.parse(doc.attachmentUrl) as unknown;
      return Array.isArray(raw) ? (raw as BreakageAttachmentMeta[]) : [];
    } catch {
      return [];
    }
  }

  fetch(id: string): void {
    this.loading.set(true);
    this.error.set('');
    this.api
      .getById(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (d) => {
          this.doc.set(d);
          this.attachments.set(this.parseAttachments(d));
          this.loading.set(false);
        },
        error: () => {
          this.error.set(this.translate.instant('BREAKAGE.DETAIL.LOAD_ERROR'));
          this.loading.set(false);
        },
      });
  }

  statusClass(status: BreakageWorkflowStatus | string): string {
    switch (status) {
      case 'DRAFT':
        return 'pending';
      case 'DEPT_APPROVED':
      case 'COST_CONTROL_APPROVED':
      case 'FINANCE_APPROVED':
        return 'warning';
      case 'APPROVED':
        return 'active';
      case 'REJECTED':
        return 'rejected';
      case 'VOID':
        return 'inactive';
      default:
        return 'pending';
    }
  }

  num(v: string | number | null | undefined): number {
    return Number(v ?? 0);
  }

  userName(u: { firstName: string; lastName: string } | null | undefined): string {
    if (!u) return '—';
    return `${u.firstName} ${u.lastName}`.trim();
  }

  canSubmit(): boolean {
    const d = this.doc();
    const u = this.auth.currentUser();
    if (!d || !u || d.status !== 'DRAFT') return false;
    return this.auth.hasPermission('BREAKAGE_CREATE') || u.id === d.createdBy;
  }

  canApprove(): boolean {
    const d = this.doc();
    const u = this.auth.currentUser();
    if (!d || !u) return false;
    if (!this.auth.hasPermission(WORKFLOW_PERMISSION_APPROVE_BREAKAGE)) return false;
    const step = pendingApprovalStepFromContext(d);
    if (!step) return false;
    return userMatchesCurrentApprovalChainStep(u.role, requiredRoleCodeFromStep(step), d);
  }

  private hasApprovalRequestChain(d: BreakageDetail): boolean {
    const steps = d.approvalRequests?.[0]?.steps;
    return Array.isArray(steps) && steps.length > 0;
  }

  /** Unified workflow UI: get-pass returns or any breakage with an approval chain. */
  shouldUseUnifiedBreakageUi(d: BreakageDetail): boolean {
    return d.sourceType === 'GET_PASS_RETURN' || this.hasApprovalRequestChain(d);
  }

  canVoid(): boolean {
    const d = this.doc();
    const u = this.auth.currentUser();
    if (!d || !u) return false;
    if (d.status !== 'DRAFT' && d.status !== 'REJECTED') return false;
    return this.auth.hasPermission('BREAKAGE_CREATE');
  }

  submit(): void {
    const id = this.doc()?.id;
    if (!id) return;
    this.confirmation
      .confirm({
        title: this.translate.instant('BREAKAGE.DETAIL.CONFIRM_SUBMIT_TITLE'),
        message: this.translate.instant('BREAKAGE.DETAIL.CONFIRM_SUBMIT_MSG'),
        confirmText: this.translate.instant('COMMON.CONFIRM'),
        cancelText: this.translate.instant('COMMON.CANCEL'),
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((ok) => {
        if (!ok) return;
        this.actionBusy.set(true);
        this.api
          .submit(id)
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe({
            next: (d) => {
              this.doc.set(d);
              this.attachments.set(this.parseAttachments(d));
              this.actionBusy.set(false);
              this.message.success(this.translate.instant('BREAKAGE.DETAIL.ACTION_OK'));
            },
            error: (e: Error) => {
              this.actionBusy.set(false);
              this.message.error(e.message || this.translate.instant('BREAKAGE.DETAIL.ACTION_FAIL'));
            },
          });
      });
  }

  openLegacyApprovalModal(): void {
    this.approvalAction.set('APPROVE');
    this.approvalComment.set('');
    this.approvalOpen.set(true);
  }

  openReturnsWorkflowApprove(): void {
    this.returnsWorkflowOpen.set(true);
  }

  closeReturnsWorkflow(): void {
    if (this.returnsWorkflowSubmitting()) return;
    this.returnsWorkflowOpen.set(false);
  }

  onReturnsWorkflowSubmitted(accountability: ReturnsAccountabilityType): void {
    const d = this.doc();
    const id = d?.id;
    if (!id || !d) return;
    this.returnsWorkflowSubmitting.set(true);
    this.api
      .approveAtCurrentStep(
        id,
        {
          sourceType: d.sourceType,
          status: String(d.status),
          approvalRequests: d.approvalRequests,
        },
        { accountability },
      )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.returnsWorkflowOpen.set(false);
          this.returnsWorkflowSubmitting.set(false);
          this.message.success(this.translate.instant('BREAKAGE.DETAIL.ACTION_OK'));
          this.fetch(id);
        },
        error: (e: Error) => {
          this.returnsWorkflowSubmitting.set(false);
          this.message.error(e.message || this.translate.instant('BREAKAGE.DETAIL.ACTION_FAIL'));
        },
      });
  }

  openRejectModal(): void {
    this.rejectComment.set('');
    this.rejectModalOpen.set(true);
  }

  confirmReject(): void {
    const id = this.doc()?.id;
    const comment = this.rejectComment().trim();
    if (!id) return;
    if (!comment) {
      this.message.warning(this.translate.instant('BREAKAGE.DETAIL.REJECT_REASON_REQUIRED'));
      return;
    }
    this.actionBusy.set(true);
    this.api
      .reject(id, comment)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.rejectModalOpen.set(false);
          this.actionBusy.set(false);
          this.message.success(this.translate.instant('BREAKAGE.DETAIL.ACTION_OK'));
          this.fetch(id);
        },
        error: (e: Error) => {
          this.actionBusy.set(false);
          this.message.error(e.message || this.translate.instant('BREAKAGE.DETAIL.ACTION_FAIL'));
        },
      });
  }

  confirmApproval(): void {
    const d = this.doc();
    const id = d?.id;
    const action = this.approvalAction();
    const comment = this.approvalComment().trim();
    if (!id || !d) return;
    if (action === 'REJECT' && !comment) {
      this.message.warning(this.translate.instant('BREAKAGE.DETAIL.REJECT_REASON_REQUIRED'));
      return;
    }
    this.actionBusy.set(true);
    const req =
      action === 'APPROVE'
        ? this.api.approveAtCurrentStep(
            id,
            {
              sourceType: d.sourceType,
              status: String(d.status),
              approvalRequests: d.approvalRequests,
            },
            { comment: comment || undefined },
          )
        : this.api.reject(id, comment);
    req.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.approvalOpen.set(false);
        this.actionBusy.set(false);
        this.message.success(this.translate.instant('BREAKAGE.DETAIL.ACTION_OK'));
        this.fetch(id);
      },
      error: (e: Error) => {
        this.actionBusy.set(false);
        this.message.error(e.message || this.translate.instant('BREAKAGE.DETAIL.ACTION_FAIL'));
      },
    });
  }

  setApprovalAction(action: 'APPROVE' | 'REJECT'): void {
    this.approvalAction.set(action);
  }

  voidDoc(): void {
    const id = this.doc()?.id;
    if (!id) return;
    this.confirmation
      .confirm({
        title: this.translate.instant('BREAKAGE.DETAIL.CONFIRM_VOID_TITLE'),
        message: this.translate.instant('BREAKAGE.DETAIL.CONFIRM_VOID_MSG'),
        confirmText: this.translate.instant('COMMON.CONFIRM'),
        cancelText: this.translate.instant('COMMON.CANCEL'),
        confirmDanger: true,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((ok) => {
        if (!ok) return;
        this.actionBusy.set(true);
        this.api
          .voidDocument(id)
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe({
            next: (d) => {
              this.doc.set(d);
              this.actionBusy.set(false);
              this.message.success(this.translate.instant('BREAKAGE.DETAIL.ACTION_OK'));
            },
            error: (e: Error) => {
              this.actionBusy.set(false);
              this.message.error(e.message || this.translate.instant('BREAKAGE.DETAIL.ACTION_FAIL'));
            },
          });
      });
  }

  viewEvidence(): void {
    const id = this.doc()?.id;
    if (!id) return;
    this.api
      .evidenceJson(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => {
          const w = window.open('', '_blank');
          if (w) {
            w.document.write(`<pre>${JSON.stringify(data, null, 2)}</pre>`);
            w.document.title = this.doc()?.documentNo ?? 'Evidence';
          }
        },
        error: () => this.message.error(this.translate.instant('BREAKAGE.DETAIL.EVIDENCE_FAIL')),
      });
  }

  downloadPdf(): void {
    const id = this.doc()?.id;
    const no = this.doc()?.documentNo ?? 'breakage';
    if (!id) return;
    this.api
      .downloadEvidencePdf(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (blob) => {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `Evidence-${no}.pdf`;
          a.click();
          URL.revokeObjectURL(url);
        },
        error: () => this.message.error(this.translate.instant('BREAKAGE.DETAIL.PDF_FAIL')),
      });
  }

  onFileUpload(e: Event): void {
    const id = this.doc()?.id;
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!id || !file) return;
    if (file.size > 10 * 1024 * 1024) {
      this.message.error(this.translate.instant('BREAKAGE.DETAIL.FILE_TOO_LARGE'));
      return;
    }
    this.uploadBusy.set(true);
    this.api
      .uploadAttachment(id, file)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (d) => {
          this.doc.set(d);
          this.attachments.set(this.parseAttachments(d));
          this.uploadBusy.set(false);
          this.message.success(this.translate.instant('BREAKAGE.DETAIL.UPLOAD_OK'));
        },
        error: (err: Error) => {
          this.uploadBusy.set(false);
          this.message.error(err.message || this.translate.instant('BREAKAGE.DETAIL.UPLOAD_FAIL'));
        },
      });
  }

  attachmentHref(a: BreakageAttachmentMeta): string {
    const name = a.url.replace(/\\/g, '/').split('/').pop() ?? a.filename;
    return `${this.serverOrigin}/uploads/attachments/${name}`;
  }
}
