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
import type {
  ApprovalStepDetail,
  BreakageAttachmentMeta,
  BreakageDetail,
  BreakageWorkflowStatus,
} from '../models/breakage.model';
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
  readonly approvalOpen = signal(false);
  readonly approvalAction = signal<'APPROVE' | 'REJECT'>('APPROVE');
  readonly approvalComment = signal('');

  readonly attachments = signal<BreakageAttachmentMeta[]>([]);

  readonly serverOrigin = environment.apiUrl.replace(/\/api\/?$/, '');

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
    const approval = d.approvalRequests?.[0];
    if (!approval) return false;
    const stepNo = approval.currentStep;
    const step = approval.steps?.find((s) => s.stepNumber === stepNo);
    if (!step || step.status !== 'PENDING') return false;
    return this.auth.hasPermission('BREAKAGE_APPROVE_REJECT');
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

  openApproval(): void {
    this.approvalAction.set('APPROVE');
    this.approvalComment.set('');
    this.approvalOpen.set(true);
  }

  confirmApproval(): void {
    const id = this.doc()?.id;
    const action = this.approvalAction();
    const comment = this.approvalComment().trim();
    if (!id) return;
    if (action === 'REJECT' && !comment) {
      this.message.warning(this.translate.instant('BREAKAGE.DETAIL.REJECT_REASON_REQUIRED'));
      return;
    }
    this.actionBusy.set(true);
    const req = action === 'APPROVE' ? this.api.approve(id, comment) : this.api.reject(id, comment);
    req.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (d) => {
        this.doc.set(d);
        this.attachments.set(this.parseAttachments(d));
        this.approvalOpen.set(false);
        this.actionBusy.set(false);
        this.message.success(this.translate.instant('BREAKAGE.DETAIL.ACTION_OK'));
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

  roleLabel(role: string): string {
    return this.translate.instant(`COMMON.ROLES.${role}`);
  }

  stepStatusLabel(step: ApprovalStepDetail): string {
    if (step.status === 'APPROVED' && step.actedByUser && step.actedAt) {
      return this.translate.instant('BREAKAGE.DETAIL.STAMP_APPROVED', {
        user: this.userName(step.actedByUser),
        date: new Date(step.actedAt).toLocaleString(),
      });
    }
    if (step.status === 'REJECTED' && step.actedByUser && step.actedAt) {
      return this.translate.instant('BREAKAGE.DETAIL.STAMP_REJECTED', {
        user: this.userName(step.actedByUser),
        date: new Date(step.actedAt).toLocaleString(),
      });
    }
    return this.translate.instant(`BREAKAGE.DETAIL.STEP_STATUS.${step.status}`);
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
