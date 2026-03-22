import { DatePipe, NgClass } from '@angular/common';
import {
  Component,
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
import { Router } from '@angular/router';
import type { MovementDocumentRow } from '../models/movement-document.model';
import { MovementDocumentsService } from '../services/movement-documents.service';

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
  private readonly documentsApi = inject(MovementDocumentsService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);
  private readonly translate = inject(TranslateService);
  private readonly reload$ = new Subject<void>();

  readonly lucidePlus = Plus;
  readonly lucideSearch = Search;

  readonly documents = signal<MovementDocumentRow[]>([]);
  readonly total = signal(0);
  readonly loading = signal(false);
  readonly listError = signal('');
  readonly searchTerm = signal('');

  readonly pageIndex = signal(1);
  readonly pageSize = signal(50);

  ngOnInit(): void {
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
}
