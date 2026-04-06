import { DestroyRef, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable, Subject } from 'rxjs';
import { debounceTime, first } from 'rxjs/operators';

export interface MasterDataListResult<TRow> {
  items: TRow[];
  total: number;
}

export interface MasterDataLoadParams {
  search?: string;
  skip: number;
  take: number;
}

export class BaseMasterDataController<TRow> {
  readonly rows = signal<TRow[]>([]);
  readonly total = signal(0);
  readonly loading = signal(false);
  readonly listError = signal('');

  readonly searchDraft = signal('');
  readonly searchTerm = signal('');
  readonly pageIndex = signal(1);
  readonly pageSize = signal(25);

  private readonly search$ = new Subject<string>();

  constructor(
    private readonly destroyRef: DestroyRef,
    private readonly loader: (
      params: MasterDataLoadParams,
    ) => Observable<MasterDataListResult<TRow>>,
    private readonly fallbackError: () => string,
    initialPageSize = 25,
  ) {
    this.pageSize.set(initialPageSize);
    this.search$
      .pipe(debounceTime(300), takeUntilDestroyed(this.destroyRef))
      .subscribe((q) => {
        this.searchTerm.set(q);
        this.pageIndex.set(1);
        this.load();
      });
  }

  onSearchChange(value: string): void {
    this.searchDraft.set(value);
    this.search$.next(value.trim());
  }

  onPageIndexChange(i: number): void {
    this.pageIndex.set(i);
    this.load();
  }

  onPageSizeChange(n: number): void {
    this.pageSize.set(n);
    this.pageIndex.set(1);
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.listError.set('');
    const skip = (this.pageIndex() - 1) * this.pageSize();
    this.loader({
      search: this.searchTerm() || undefined,
      skip,
      take: this.pageSize(),
    })
      .pipe(first())
      .subscribe({
        next: (res) => {
          this.rows.set(res.items);
          this.total.set(res.total);
          this.loading.set(false);
        },
        error: (err: { error?: { message?: string } }) => {
          this.loading.set(false);
          this.listError.set(err?.error?.message ?? this.fallbackError());
        },
      });
  }
}
