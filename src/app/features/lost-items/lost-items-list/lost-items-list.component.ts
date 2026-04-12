import { DatePipe } from '@angular/common';
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
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzTableModule } from 'ng-zorro-antd/table';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { LucideAngularModule } from 'lucide-angular';
import { PackageX, RefreshCw, Search } from 'lucide-angular';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import type { LostItemsListRow } from '../models/lost-items.model';
import { LostItemsService } from '../services/lost-items.service';

@Component({
  selector: 'app-lost-items-list',
  standalone: true,
  imports: [
    DatePipe,
    FormsModule,
    NzAlertModule,
    NzButtonModule,
    NzInputModule,
    NzTableModule,
    TranslatePipe,
    LucideAngularModule,
    EmptyStateComponent,
  ],
  templateUrl: './lost-items-list.component.html',
  styleUrl: './lost-items-list.component.scss',
})
export class LostItemsListComponent implements OnInit {
  private readonly api = inject(LostItemsService);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);

  readonly lucidePackageX = PackageX;
  readonly lucideRefresh = RefreshCw;
  readonly lucideSearch = Search;

  readonly pageSize = 20;

  readonly rows = signal<LostItemsListRow[]>([]);
  readonly total = signal(0);
  readonly loading = signal(false);
  readonly listError = signal('');
  readonly search = signal('');
  readonly page = signal(0);

  private readonly search$ = new Subject<string>();

  ngOnInit(): void {
    this.search$
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.page.set(0);
        this.load();
      });
    this.load();
  }

  onSearchInput(v: string): void {
    this.search.set(v);
    this.search$.next(v);
  }

  load(): void {
    this.loading.set(true);
    this.listError.set('');
    this.api
      .list({
        skip: this.page() * this.pageSize,
        take: this.pageSize,
        search: this.search().trim() || undefined,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (r) => {
          this.rows.set(r.items);
          this.total.set(r.total);
          this.loading.set(false);
        },
        error: () => {
          this.listError.set(this.translate.instant('LOST_ITEMS.LIST.ERROR_LOAD'));
          this.loading.set(false);
        },
      });
  }

  displayUser(row: LostItemsListRow): string {
    const u = row.lossRecordedBy;
    if (!u) return '—';
    return `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim() || '—';
  }

  nextPage(): void {
    const maxPage = Math.max(0, Math.ceil(this.total() / this.pageSize) - 1);
    if (this.page() < maxPage) {
      this.page.update((p) => p + 1);
      this.load();
    }
  }

  prevPage(): void {
    if (this.page() > 0) {
      this.page.update((p) => p - 1);
      this.load();
    }
  }
}
