import { DatePipe, NgClass } from '@angular/common';
import {
  Component,
  computed,
  DestroyRef,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { debounceTime, first } from 'rxjs/operators';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzTableModule } from 'ng-zorro-antd/table';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { LucideAngularModule } from 'lucide-angular';
import { Plus, Search } from 'lucide-angular';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { injectMatchMinWidth } from '../../../shared/utils/viewport-media';
import { Router } from '@angular/router';
import type { MovementDocumentRow } from '../models/movement-document.model';
import { MovementDocumentsService } from '../services/movement-documents.service';
import { ItemsService } from '../../items/services/items.service';
import type { RequirementsResponse } from '../../items/models/item.model';

@Component({
  selector: 'app-movement-list',
  standalone: true,
  imports: [
    FormsModule,
    DatePipe,
    NgClass,
    NzAlertModule,
    NzButtonModule,
    NzInputModule,
    NzTableModule,
    TranslatePipe,
    LucideAngularModule,
    EmptyStateComponent,
  ],
  templateUrl: './movement-list.component.html',
  styleUrl: './movement-list.component.scss',
})
export class MovementListComponent implements OnInit {
  private static readonly DEFAULT_OB_STATUS: NonNullable<RequirementsResponse['obStatus']> = 'FINALIZED';

  private readonly documentsApi = inject(MovementDocumentsService);
  private readonly itemsApi = inject(ItemsService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);
  private readonly translate = inject(TranslateService);
  private readonly reload$ = new Subject<void>();

  readonly lucidePlus = Plus;
  readonly lucideSearch = Search;

  private readonly viewportIsDesktop = injectMatchMinWidth(768);

  readonly nzTableScroll = computed(() =>
    this.viewportIsDesktop() ? {} : { x: '900px' },
  );

  readonly documents = signal<MovementDocumentRow[]>([]);
  readonly total = signal(0);
  readonly loading = signal(false);
  readonly listError = signal('');
  readonly searchTerm = signal('');
  readonly obStatus = signal<NonNullable<RequirementsResponse['obStatus']>>(
    MovementListComponent.DEFAULT_OB_STATUS,
  );
  readonly showSetupInProgress = computed(
    () => this.obStatus() === 'OPEN' || this.obStatus() === 'INITIAL_LOCK',
  );
  readonly canRenderMovements = computed(() => this.obStatus() === 'FINALIZED');

  readonly pageIndex = signal(1);
  readonly pageSize = signal(50);

  ngOnInit(): void {
    this.loadRequirements();
    this.reload$
      .pipe(debounceTime(250), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.loadDocuments());

    this.reload$.next();
  }

  onSearchChange(value: string): void {
    this.searchTerm.set(value);
    this.pageIndex.set(1);
    this.reload$.next();
  }

  onPageIndexChange(i: number): void {
    this.pageIndex.set(i);
    this.reload$.next();
  }

  onPageSizeChange(n: number): void {
    this.pageSize.set(n);
    this.pageIndex.set(1);
    this.reload$.next();
  }

  getStatusClass(status: string): string {
    switch (status) {
      case 'DRAFT':
        return 'draft';
      case 'POSTED':
        return 'posted';
      case 'REJECTED':
        return 'rejected';
      default:
        return 'pending';
    }
  }

  getTypeLabel(type: string): string {
    return this.t(`MOVEMENTS.TYPES.${type}`);
  }

  goToNewMovement(): void {
    this.router.navigate(['/movements', 'new']);
  }

  goToDocument(doc: MovementDocumentRow): void {
    this.router.navigate(['/movements', doc.id]);
  }

  private loadDocuments(): void {
    if (!this.canRenderMovements()) {
      this.documents.set([]);
      this.total.set(0);
      this.loading.set(false);
      return;
    }
    const skip = (this.pageIndex() - 1) * this.pageSize();
    const take = this.pageSize();
    const search = this.searchTerm().trim() || undefined;

    this.loading.set(true);
    this.listError.set('');

    this.documentsApi
      .list({ skip, take, search })
      .pipe(first())
      .subscribe({
        next: (res) => {
          this.documents.set(res.documents);
          this.total.set(res.total);
          this.loading.set(false);
        },
        error: (err: { error?: { message?: string } }) => {
          this.loading.set(false);
          this.listError.set(err?.error?.message ?? this.t('MOVEMENTS.ERROR_LOAD'));
        },
      });
  }

  private t(key: string, params?: Record<string, unknown>): string {
    return this.translate.instant(key, params);
  }

  private loadRequirements(): void {
    this.itemsApi
      .checkRequirements()
      .pipe(first())
      .subscribe({
        next: (res) => {
          if (!res.success || !res.data) {
            this.obStatus.set(MovementListComponent.DEFAULT_OB_STATUS);
            return;
          }
          const normalizedObStatus =
            res.data.obStatus ??
            (res.data.isOpeningBalanceAllowed ? 'OPEN' : MovementListComponent.DEFAULT_OB_STATUS);
          this.obStatus.set(normalizedObStatus);
        },
        error: () => this.obStatus.set(MovementListComponent.DEFAULT_OB_STATUS),
      });
  }
}
