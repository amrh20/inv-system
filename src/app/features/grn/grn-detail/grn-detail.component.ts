import { DatePipe, DecimalPipe, NgClass } from '@angular/common';
import {
  Component,
  DestroyRef,
  inject,
  OnInit,
  signal,
  computed,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { of, Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap, tap } from 'rxjs/operators';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { NzMessageService } from 'ng-zorro-antd/message';
import {
  Check,
  Loader2,
  LucideAngularModule,
  Package,
  Search,
  Trash2,
} from 'lucide-angular';
import { AuthService } from '../../../core/services/auth.service';
import { ConfirmationService } from '../../../core/services/confirmation.service';
import { environment } from '../../../../environments/environment';
import type { ItemListRow } from '../../items/models/item.model';
import { ItemsService } from '../../items/services/items.service';
import {
  grnStatusI18nSuffix,
  type GrnCreateLinePayload,
  type GrnDetail,
  type GrnLineDetail,
  type GrnRejectedLineDraft,
} from '../models/grn.model';
import { GrnService } from '../services/grn.service';

type ItemSearchTier = 'match' | 'new' | 'conflict';

interface CategorizedItemRow {
  item: ItemListRow;
  tier: ItemSearchTier;
  conflictSupplierName?: string;
}

@Component({
  selector: 'app-grn-detail',
  standalone: true,
  providers: [ConfirmationService],
  imports: [
    DatePipe,
    DecimalPipe,
    NgClass,
    FormsModule,
    NzAlertModule,
    NzButtonModule,
    NzInputModule,
    NzModalModule,
    NzTableModule,
    NzTagModule,
    TranslatePipe,
    LucideAngularModule,
  ],
  templateUrl: './grn-detail.component.html',
  styleUrl: './grn-detail.component.scss',
})
export class GrnDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly grnApi = inject(GrnService);
  private readonly itemsApi = inject(ItemsService);
  private readonly auth = inject(AuthService);
  private readonly confirmation = inject(ConfirmationService);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);

  readonly grn = signal<GrnDetail | null>(null);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly actionError = signal('');
  readonly rejectReason = signal('');
  readonly showReject = signal(false);
  readonly acting = signal(false);
  readonly rejectReviewModalOpen = signal(false);
  readonly rejectReviewReason = signal('');
  readonly rejectReviewError = signal('');

  readonly lucideCheck = Check;
  readonly lucideSearch = Search;
  readonly lucideLoader = Loader2;
  readonly lucideTrash = Trash2;
  readonly lucidePackage = Package;

  readonly rejectedEditLines = signal<GrnRejectedLineDraft[]>([]);
  readonly itemQuery = signal('');
  readonly itemResults = signal<ItemListRow[]>([]);
  readonly itemSearchLoading = signal(false);
  readonly itemDropdownOpen = signal(false);
  readonly updatingItems = signal(false);
  readonly invalidRejectedLineIndexes = signal<number[]>([]);

  private readonly search$ = new Subject<string>();

  readonly isFinance = computed(() => {
    return this.auth.hasPermission('GRN_APPROVE_POST');
  });

  readonly canManageGrn = computed(() => this.auth.hasPermission('GRN_MANAGE'));

  /**
   * Bottom bar on APPROVED: Post to Ledger + Finance reject (return before posting).
   * FINANCE_MANAGER and ADMIN only — matches POST /grn/:id/post and PATCH /grn/:id/status (REJECTED from APPROVED).
   */
  readonly canShowApprovedFinanceBar = computed(() =>
    this.auth.hasRole('FINANCE_MANAGER', 'ADMIN'),
  );

  readonly showApprovedPostBar = computed(() => {
    const g = this.grn();
    return g?.status === 'APPROVED' && this.canShowApprovedFinanceBar();
  });

  /** Reject modal opened from APPROVED finance bar — distinct copy vs Cost Control review. */
  readonly rejectReviewFromFinanceApproved = signal(false);

  readonly isStorekeeper = computed(() => this.auth.hasRole('STOREKEEPER'));

  /**
   * "Submit for approval" on VALIDATED — hidden for storekeeper (already sent to Cost Control on create)
   * and for Cost Control / Admin (they use Approve/Reject instead).
   */
  readonly showSubmitForApproval = computed(() => {
    const g = this.grn();
    return (
      g?.status === 'VALIDATED' &&
      this.canManageGrn() &&
      !this.isGrnStatusReviewer() &&
      !this.isStorekeeper()
    );
  });

  /** Workflow actions card (validate / submit / approve / reject) — not used for APPROVED+post (sticky bar). */
  readonly showMainWorkflowActionsCard = computed(() => {
    const g = this.grn();
    if (!g) return false;
    return (
      (g.status === 'DRAFT' && this.canManageGrn()) ||
      this.showSubmitForApproval() ||
      (g.status === 'PENDING_APPROVAL' && this.isFinance())
    );
  });

  /** Approve/reject VALIDATED GRNs: Cost Control and Admin only (aligned with PATCH /grn/:id/status). */
  readonly isGrnStatusReviewer = computed(() => this.auth.hasRole('COST_CONTROL', 'ADMIN'));

  readonly showValidatedReviewBar = computed(() => {
    const g = this.grn();
    return g?.status === 'VALIDATED' && this.isGrnStatusReviewer();
  });

  /** Storekeeper: GRN is already in Cost Control queue after create — no further submit action. */
  readonly showStorekeeperValidatedAlert = computed(() => {
    const g = this.grn();
    return g?.status === 'VALIDATED' && this.isStorekeeper();
  });

  /** Reviewer cue when a resubmitted GRN was patched after a prior rejection (flag cleared on finance approve). */
  readonly showReviewerEditedAfterRejectionAlert = computed(() => {
    const g = this.grn();
    return (
      !!g?.isEditedAfterRejection &&
      (g.status === 'VALIDATED' || g.status === 'APPROVED')
    );
  });

  readonly mappedCount = computed(() => {
    const g = this.grn();
    return g?.lines?.filter((l) => l.isMapped).length ?? 0;
  });

  readonly unmappedCount = computed(() => {
    const g = this.grn();
    const n = g?.lines?.length ?? 0;
    return n - this.mappedCount();
  });

  readonly showRejectedLineEdit = computed(() => {
    const g = this.grn();
    return g?.status === 'REJECTED' && this.canManageGrn();
  });

  readonly supplierIdForRejectedItemSearch = computed(() => this.grn()?.vendor?.id?.trim() ?? '');

  readonly rejectedItemSearchDisabled = computed(() => !this.supplierIdForRejectedItemSearch());

  readonly categorizedRejectedItemRows = computed((): CategorizedItemRow[] => {
    const sid = this.supplierIdForRejectedItemSearch();
    const items = this.itemResults();
    if (!sid || items.length === 0) return [];
    const rank: Record<ItemSearchTier, number> = { match: 0, new: 1, conflict: 2 };
    const rows: CategorizedItemRow[] = items.map((item) => {
      const prefId = item.supplier?.id ?? null;
      let tier: ItemSearchTier;
      let conflictSupplierName: string | undefined;
      if (!prefId) {
        tier = 'new';
      } else if (prefId === sid) {
        tier = 'match';
      } else {
        tier = 'conflict';
        conflictSupplierName = item.supplier?.name ?? '';
      }
      return { item, tier, conflictSupplierName };
    });
    rows.sort(
      (a, b) =>
        rank[a.tier] - rank[b.tier] || a.item.name.localeCompare(b.item.name, undefined, { sensitivity: 'base' }),
    );
    return rows;
  });

  readonly rejectedEditGrandTotal = computed(() =>
    this.rejectedEditLines().reduce(
      (sum, l) => sum + (Number(l.receivedQty) || 0) * (Number(l.unitPrice) || 0),
      0,
    ),
  );

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.error.set(this.translate.instant('GRN.DETAIL.NOT_FOUND'));
      this.loading.set(false);
      return;
    }
    this.search$
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        switchMap((q) => {
          if (!q || q.length < 2 || !this.supplierIdForRejectedItemSearch()) {
            return of(null).pipe(
              tap(() => {
                this.itemResults.set([]);
                this.itemSearchLoading.set(false);
                this.itemDropdownOpen.set(false);
              }),
            );
          }
          this.itemSearchLoading.set(true);
          return this.itemsApi.list({ search: q, take: 30, isActive: 'true' }).pipe(
            tap(() => this.itemSearchLoading.set(false)),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (res) => {
          if (res === null) return;
          this.itemResults.set(res.items);
          this.itemDropdownOpen.set(true);
        },
        error: () => {
          this.itemSearchLoading.set(false);
          this.itemResults.set([]);
        },
      });

    this.fetch(id);
  }

  back(): void {
    this.router.navigate(['/grn']);
  }

  invoiceHref(pdfAttachmentUrl: string): string {
    const base = environment.apiUrl.replace(/\/api\/?$/, '');
    const normalized = pdfAttachmentUrl.replace(/\\/g, '/');
    const filename = normalized.split('/').pop() ?? '';
    const subfolder = normalized.includes('/invoices/') ? '/invoices/' : '/';
    return `${base}/uploads/grn${subfolder}${filename}`;
  }

  statusLabelSuffix(status: GrnDetail['status']): string {
    return grnStatusI18nSuffix(status);
  }

  statusClass(status: GrnDetail['status']): string {
    switch (status) {
      case 'DRAFT':
        return 'draft';
      case 'VALIDATED':
        return 'processing';
      case 'PENDING_APPROVAL':
        return 'pending';
      case 'APPROVED':
        return 'success';
      case 'POSTED':
        return 'posted';
      case 'REJECTED':
        return 'rejected';
      default:
        return 'pending';
    }
  }

  validateGrn(): void {
    const id = this.grn()?.id;
    if (!id) return;
    this.confirmation
      .confirm({
        title: this.translate.instant('GRN.DETAIL.CONFIRM_VALIDATE_TITLE'),
        message: this.translate.instant('GRN.DETAIL.CONFIRM_VALIDATE_MSG'),
        confirmText: this.translate.instant('COMMON.CONFIRM'),
        cancelText: this.translate.instant('COMMON.CANCEL'),
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((ok) => {
        if (ok) this.runAction(id, 'validate');
      });
  }

  submitForApproval(): void {
    const id = this.grn()?.id;
    if (!id) return;
    this.confirmation
      .confirm({
        title: this.translate.instant('GRN.DETAIL.CONFIRM_SUBMIT_TITLE'),
        message: this.translate.instant('GRN.DETAIL.CONFIRM_SUBMIT_MSG'),
        confirmText: this.translate.instant('COMMON.CONFIRM'),
        cancelText: this.translate.instant('COMMON.CANCEL'),
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((ok) => {
        if (ok) this.runAction(id, 'submit');
      });
  }

  approve(): void {
    const id = this.grn()?.id;
    if (!id) return;
    this.confirmation
      .confirm({
        title: this.translate.instant('GRN.DETAIL.CONFIRM_APPROVE_TITLE'),
        message: this.translate.instant('GRN.DETAIL.CONFIRM_APPROVE_MSG'),
        confirmText: this.translate.instant('COMMON.CONFIRM'),
        cancelText: this.translate.instant('COMMON.CANCEL'),
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((ok) => {
        if (ok) this.runAction(id, 'approve', { comment: 'Approved' });
      });
  }

  openReject(): void {
    this.showReject.set(true);
    this.rejectReason.set('');
    this.actionError.set('');
  }

  cancelReject(): void {
    this.showReject.set(false);
  }

  confirmReject(): void {
    const id = this.grn()?.id;
    const reason = this.rejectReason().trim();
    if (!id || !reason) return;
    this.runAction(id, 'reject', { reason });
    this.showReject.set(false);
  }

  lineItemName(line: GrnLineDetail): string {
    return line.item?.name?.trim() || line.futurelogDescription || '—';
  }

  onRejectedItemQueryChange(value: string): void {
    this.itemQuery.set(value);
    this.search$.next(value.trim());
  }

  addRejectedLine(entry: CategorizedItemRow): void {
    const item = entry.item;
    if (this.rejectedEditLines().some((l) => l.itemId === item.id)) return;

    if (entry.tier === 'conflict') {
      const name = entry.conflictSupplierName?.trim() || '—';
      this.message.warning(
        this.translate.instant('GRN.CREATE.SUPPLIER_CONFLICT_TOAST', { supplier: name }),
      );
    }

    const itemId = (item.id ?? '').trim();
    if (!this.isValidUuidString(itemId)) {
      this.message.error(this.translate.instant('GRN.CREATE.ERROR_ADD_INVALID_ITEM_ID'));
      return;
    }

    const baseUom = this.resolveBaseUomFromItem(item);
    if (!baseUom || !this.isValidUuidString(baseUom.uomId)) {
      this.message.error(this.translate.instant('GRN.CREATE.ERROR_ADD_NO_BASE_UOM'));
      return;
    }

    this.rejectedEditLines.update((prev) => [
      ...prev,
      {
        clientKey: crypto.randomUUID(),
        itemId,
        itemName: item.name,
        barcode: item.barcode ?? '',
        imageUrl: item.imageUrl ?? null,
        uomId: baseUom.uomId,
        uomName: baseUom.uomName,
        receivedQty: '',
        unitPrice: item.unitPrice ?? '',
      },
    ]);
    this.clearRejectedLineValidationUi();
    this.itemQuery.set('');
    this.itemResults.set([]);
    this.itemDropdownOpen.set(false);
  }

  updateRejectedLine(idx: number, field: keyof GrnRejectedLineDraft, value: string | number): void {
    const v = value === null || value === undefined ? '' : String(value);
    this.clearRejectedLineValidationUi();
    this.rejectedEditLines.update((rows) =>
      rows.map((row, i) => (i === idx ? { ...row, [field]: v } : row)),
    );
  }

  removeRejectedLine(idx: number): void {
    this.confirmation
      .confirm({
        title: this.translate.instant('GRN.DETAIL.CONFIRM_REMOVE_LINE_TITLE'),
        message: this.translate.instant('GRN.DETAIL.CONFIRM_REMOVE_LINE_MSG'),
        confirmText: this.translate.instant('COMMON.CONFIRM'),
        cancelText: this.translate.instant('COMMON.CANCEL'),
        confirmDanger: true,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((ok) => {
        if (!ok) return;
        this.clearRejectedLineValidationUi();
        this.rejectedEditLines.update((rows) => rows.filter((_, i) => i !== idx));
      });
  }

  rejectedLineTotal(line: GrnRejectedLineDraft): number {
    return (Number(line.receivedQty) || 0) * (Number(line.unitPrice) || 0);
  }

  updateRejectedItems(): void {
    const id = this.grn()?.id;
    if (!id) return;
    const built = this.buildRejectedPatchLines();
    if (!built) return;
    this.updatingItems.set(true);
    this.actionError.set('');
    this.grnApi
      .patch(id, { lines: built })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (g) => {
          this.updatingItems.set(false);
          this.grn.set(g);
          this.rejectedEditLines.set(this.initRejectedEditLinesFromDetail(g.lines ?? []));
          this.message.success(this.translate.instant('GRN.DETAIL.UPDATE_ITEMS_OK'));
        },
        error: (err: HttpErrorResponse | { error?: { message?: string } }) => {
          this.updatingItems.set(false);
          const body = err instanceof HttpErrorResponse ? err.error : err?.error;
          this.actionError.set(
            (typeof body === 'object' && body && 'message' in body && typeof body.message === 'string'
              ? body.message
              : null) ?? this.translate.instant('GRN.DETAIL.UPDATE_ITEMS_FAIL'),
          );
        },
      });
  }

  isInvoiceImageUrl(url: string | null | undefined): boolean {
    if (!url) return false;
    return /\.(png|jpe?g|gif|webp|bmp)$/i.test(url);
  }

  approveValidatedReview(): void {
    const id = this.grn()?.id;
    if (!id) return;
    this.confirmation
      .confirm({
        title: this.translate.instant('GRN.DETAIL.CONFIRM_APPROVE_TITLE'),
        message: this.translate.instant('GRN.DETAIL.CONFIRM_APPROVE_MSG'),
        confirmText: this.translate.instant('COMMON.CONFIRM'),
        cancelText: this.translate.instant('COMMON.CANCEL'),
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((ok) => {
        if (ok) this.patchReviewStatus('APPROVED');
      });
  }

  openRejectReviewModal(): void {
    this.rejectReviewFromFinanceApproved.set(false);
    this.rejectReviewReason.set('');
    this.rejectReviewError.set('');
    this.rejectReviewModalOpen.set(true);
  }

  openFinanceApprovedRejectModal(): void {
    this.rejectReviewFromFinanceApproved.set(true);
    this.rejectReviewReason.set('');
    this.rejectReviewError.set('');
    this.rejectReviewModalOpen.set(true);
  }

  onRejectReviewModalVisibleChange(visible: boolean): void {
    this.rejectReviewModalOpen.set(visible);
    if (!visible) {
      this.rejectReviewFromFinanceApproved.set(false);
    }
  }

  cancelRejectReviewModal(): void {
    this.rejectReviewModalOpen.set(false);
  }

  submitRejectReview(): void {
    const r = this.rejectReviewReason().trim();
    if (!r) {
      this.rejectReviewError.set(this.translate.instant('GRN.REASON_REQUIRED'));
      return;
    }
    this.rejectReviewError.set('');
    this.patchReviewStatus('REJECTED', r);
  }

  postToLedger(): void {
    const id = this.grn()?.id;
    if (!id) return;
    this.confirmation
      .confirm({
        title: this.translate.instant('GRN.DETAIL.CONFIRM_POST_TITLE'),
        message: this.translate.instant('GRN.DETAIL.CONFIRM_POST_MSG'),
        confirmText: this.translate.instant('GRN.DETAIL.CONFIRM_POST_OK'),
        cancelText: this.translate.instant('COMMON.CANCEL'),
        confirmDanger: true,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((ok) => {
        if (ok) this.runAction(id, 'post');
      });
  }

  resubmitRejected(): void {
    const id = this.grn()?.id;
    if (!id) return;
    this.confirmation
      .confirm({
        title: this.translate.instant('GRN.DETAIL.CONFIRM_RESUBMIT_TITLE'),
        message: this.translate.instant('GRN.DETAIL.CONFIRM_RESUBMIT_MSG'),
        confirmText: this.translate.instant('GRN.DETAIL.RESUBMIT'),
        cancelText: this.translate.instant('COMMON.CANCEL'),
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((ok) => {
        if (!ok) return;
        this.acting.set(true);
        this.actionError.set('');
        this.grnApi
          .resubmit(id)
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe({
            next: () => {
              this.acting.set(false);
              this.message.success(this.translate.instant('GRN.DETAIL.RESUBMIT_OK'));
              const tab = this.auth.hasRole('STOREKEEPER') ? 'VALIDATED' : 'APPROVED';
              void this.router.navigate(['/grn'], { queryParams: { tab } });
            },
            error: (err: { error?: { message?: string } }) => {
              this.acting.set(false);
              this.actionError.set(
                err?.error?.message ?? this.translate.instant('GRN.DETAIL.RESUBMIT_FAIL'),
              );
            },
          });
      });
  }

  private fetch(id: string): void {
    this.loading.set(true);
    this.error.set('');
    this.grnApi
      .getById(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (g) => {
          this.grn.set(g);
          if (g.status === 'REJECTED' && this.auth.hasPermission('GRN_MANAGE')) {
            this.rejectedEditLines.set(this.initRejectedEditLinesFromDetail(g.lines ?? []));
          } else {
            this.rejectedEditLines.set([]);
          }
          this.loading.set(false);
        },
        error: () => {
          this.error.set(this.translate.instant('GRN.DETAIL.LOAD_ERROR'));
          this.loading.set(false);
        },
      });
  }

  private runAction(
    id: string,
    endpoint: 'validate' | 'submit' | 'approve' | 'reject' | 'post',
    body?: unknown,
  ): void {
    this.acting.set(true);
    this.actionError.set('');
    this.grnApi
      .postAction(id, endpoint, body)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.acting.set(false);
          const okKey =
            endpoint === 'post' ? 'GRN.DETAIL.POST_OK' : 'GRN.DETAIL.ACTION_OK';
          this.message.success(this.translate.instant(okKey));
          this.fetch(id);
        },
        error: (err: { error?: { message?: string } }) => {
          this.acting.set(false);
          this.actionError.set(
            err?.error?.message ?? this.translate.instant('GRN.DETAIL.ACTION_FAIL'),
          );
        },
      });
  }

  private patchReviewStatus(status: 'APPROVED' | 'REJECTED', reason?: string): void {
    const id = this.grn()?.id;
    if (!id) return;
    this.acting.set(true);
    this.actionError.set('');
    this.grnApi
      .updateStatus(id, { status, reason })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.acting.set(false);
          this.rejectReviewModalOpen.set(false);
          this.message.success(this.translate.instant('GRN.DETAIL.ACTION_OK'));
          const tab = status === 'APPROVED' ? 'APPROVED' : 'REJECTED';
          void this.router.navigate(['/grn'], { queryParams: { tab } });
        },
        error: (err: { error?: { message?: string } }) => {
          this.acting.set(false);
          this.actionError.set(
            err?.error?.message ?? this.translate.instant('GRN.DETAIL.ACTION_FAIL'),
          );
        },
      });
  }

  private initRejectedEditLinesFromDetail(lines: GrnLineDetail[]): GrnRejectedLineDraft[] {
    return lines.map((line) => {
      const uomId = (line.uom?.id ?? line.internalUomId ?? '').trim();
      return {
        clientKey: line.id,
        itemId: (line.internalItemId ?? '').trim(),
        itemName: this.lineItemName(line),
        barcode: line.item?.barcode ?? '',
        imageUrl: null,
        uomId,
        uomName:
          line.uom?.abbreviation?.trim() ||
          line.uom?.name?.trim() ||
          line.futurelogUom ||
          '—',
        receivedQty: line.receivedQty === '' || line.receivedQty == null ? '' : String(line.receivedQty),
        unitPrice: line.unitPrice === '' || line.unitPrice == null ? '' : String(line.unitPrice),
      };
    });
  }

  /** @returns payload or null if validation failed (toasts / errors set). */
  private buildRejectedPatchLines(): GrnCreateLinePayload[] | null {
    const rows = this.rejectedEditLines();
    if (rows.length === 0) {
      this.actionError.set(this.translate.instant('GRN.CREATE.ERROR_LINES'));
      return null;
    }

    const badIndexes: number[] = [];
    let firstBadName = '';
    rows.forEach((l, i) => {
      if (!this.isValidUuidString(l.itemId) || !this.isValidUuidString(l.uomId)) {
        badIndexes.push(i);
        if (!firstBadName) {
          firstBadName = l.itemName;
        }
      }
    });
    if (badIndexes.length > 0) {
      this.flagRejectedLineIdsError(badIndexes, firstBadName);
      return null;
    }

    const badQty = rows.find((l) => !l.receivedQty || Number(l.receivedQty) <= 0);
    if (badQty) {
      this.actionError.set(
        this.translate.instant('GRN.CREATE.ERROR_RECEIVED_QTY', { name: badQty.itemName }),
      );
      return null;
    }

    this.clearRejectedLineValidationUi();

    return rows.map((l) => {
      const rq = Number(l.receivedQty);
      return {
        itemId: l.itemId.trim(),
        uomId: l.uomId.trim(),
        orderedQty: rq,
        receivedQty: rq,
        unitPrice: Number(l.unitPrice) || 0,
      };
    });
  }

  private clearRejectedLineValidationUi(): void {
    this.invalidRejectedLineIndexes.set([]);
  }

  private flagRejectedLineIdsError(badIndexes: number[], firstBadName: string): void {
    this.invalidRejectedLineIndexes.set(badIndexes);
    const msg = this.translate.instant('GRN.CREATE.ERROR_LINE_IDS', { name: firstBadName });
    this.actionError.set(msg);
    this.message.error(msg);
  }

  private isValidUuidString(value: string | undefined | null): boolean {
    if (value == null) {
      return false;
    }
    const hex = value.trim().replace(/-/g, '');
    return hex.length === 32 && /^[0-9a-fA-F]+$/.test(hex);
  }

  private resolveBaseUomFromItem(item: ItemListRow): { uomId: string; uomName: string } | null {
    const base = item.itemUnits?.find((u) => u.unitType === 'BASE');
    if (!base) {
      return null;
    }
    const row = base as {
      unitId?: string;
      unit?: { id?: string; name?: string; abbreviation?: string };
    };
    const uomId = (row.unitId ?? row.unit?.id ?? '').trim();
    if (!uomId) {
      return null;
    }
    const uomName =
      row.unit?.abbreviation?.trim() ||
      row.unit?.name?.trim() ||
      '';
    return { uomId, uomName };
  }
}
