import { NgClass } from '@angular/common';
import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { debounceTime, first } from 'rxjs/operators';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDropdownModule } from 'ng-zorro-antd/dropdown';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMenuModule } from 'ng-zorro-antd/menu';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzTableModule } from 'ng-zorro-antd/table';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { LucideAngularModule } from 'lucide-angular';
import { EllipsisVertical, Pencil, Plus, Search } from 'lucide-angular';
import { HasPermissionDirective } from '../../../../core/directives/has-permission.directive';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { UnitFormComponent } from '../unit-form/unit-form.component';
import type { UnitRow } from '../../models/unit.model';
import { UnitsService } from '../../services/units.service';

@Component({
  selector: 'app-units-list',
  standalone: true,
  imports: [
    NgClass,
    FormsModule,
    NzAlertModule,
    NzButtonModule,
    NzDropdownModule,
    NzInputModule,
    NzMenuModule,
    NzModalModule,
    NzTableModule,
    TranslatePipe,
    LucideAngularModule,
    EmptyStateComponent,
    UnitFormComponent,
    HasPermissionDirective,
  ],
  templateUrl: './units-list.component.html',
  styleUrl: './units-list.component.scss',
})
export class UnitsListComponent implements OnInit {
  private readonly api = inject(UnitsService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly translate = inject(TranslateService);

  readonly lucidePlus = Plus;
  readonly lucideSearch = Search;
  readonly lucidePencil = Pencil;
  readonly lucideEllipsisVertical = EllipsisVertical;

  readonly units = signal<UnitRow[]>([]);
  readonly total = signal(0);
  readonly loading = signal(false);
  readonly listError = signal('');

  readonly searchDraft = signal('');
  private readonly searchTerm = signal('');
  private readonly search$ = new Subject<string>();

  readonly pageIndex = signal(1);
  readonly pageSize = signal(25);

  readonly formOpen = signal(false);
  readonly formUnit = signal<UnitRow | null>(null);

  ngOnInit(): void {
    this.search$
      .pipe(debounceTime(300), takeUntilDestroyed(this.destroyRef))
      .subscribe((q) => {
        this.searchTerm.set(q);
        this.pageIndex.set(1);
        this.load();
      });
    this.load();
  }

  onSearchChange(value: string): void {
    this.searchDraft.set(value);
    this.search$.next(value.trim());
  }

  load(): void {
    this.loading.set(true);
    this.listError.set('');
    const skip = (this.pageIndex() - 1) * this.pageSize();
    this.api
      .list({
        search: this.searchTerm() || undefined,
        skip,
        take: this.pageSize(),
      })
      .pipe(first())
      .subscribe({
        next: (res) => {
          this.units.set(res.units);
          this.total.set(res.total);
          this.loading.set(false);
        },
        error: (err: { error?: { message?: string } }) => {
          this.loading.set(false);
          this.listError.set(err?.error?.message ?? this.t('UNITS.ERROR_LOAD'));
        },
      });
  }

  openCreate(): void {
    this.formUnit.set(null);
    this.formOpen.set(true);
  }

  openEdit(row: UnitRow): void {
    this.formUnit.set(row);
    this.formOpen.set(true);
  }

  closeForm(): void {
    this.formOpen.set(false);
    this.formUnit.set(null);
  }

  onFormSaved(): void {
    this.closeForm();
    this.load();
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

  private t(key: string, params?: Record<string, unknown>): string {
    return this.translate.instant(key, params);
  }
}
