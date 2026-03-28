import { NgClass } from '@angular/common';
import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { debounceTime, first } from 'rxjs/operators';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDropdownModule } from 'ng-zorro-antd/dropdown';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMenuModule } from 'ng-zorro-antd/menu';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzTableModule } from 'ng-zorro-antd/table';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { LucideAngularModule } from 'lucide-angular';
import { EllipsisVertical, Pencil, Plus, Search, Trash2 } from 'lucide-angular';
import { HasPermissionDirective } from '../../../../core/directives/has-permission.directive';
import { AuthService } from '../../../../core/services/auth.service';
import { ConfirmationService } from '../../../../core/services/confirmation.service';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { StatusToggleComponent } from '../../../../shared/components/status-toggle/status-toggle.component';
import { SupplierFormComponent } from '../supplier-form/supplier-form.component';
import type { SupplierRow } from '../../models/supplier.model';
import { SuppliersService } from '../../services/suppliers.service';

@Component({
  selector: 'app-suppliers-list',
  standalone: true,
  providers: [ConfirmationService],
  imports: [
    FormsModule,
    NgClass,
    NzAlertModule,
    NzButtonModule,
    NzDropdownModule,
    NzInputModule,
    NzMenuModule,
    NzModalModule,
    NzSelectModule,
    NzTableModule,
    TranslatePipe,
    LucideAngularModule,
    EmptyStateComponent,
    StatusToggleComponent,
    SupplierFormComponent,
    HasPermissionDirective,
  ],
  templateUrl: './suppliers-list.component.html',
  styleUrl: './suppliers-list.component.scss',
})
export class SuppliersListComponent implements OnInit {
  private readonly api = inject(SuppliersService);
  private readonly auth = inject(AuthService);
  private readonly confirmation = inject(ConfirmationService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly translate = inject(TranslateService);

  protected readonly canEditBasicData = computed(() => this.auth.hasPermission('BASIC_DATA_EDIT'));

  readonly lucidePlus = Plus;
  readonly lucideSearch = Search;
  readonly lucidePencil = Pencil;
  readonly lucideTrash = Trash2;
  readonly lucideEllipsisVertical = EllipsisVertical;

  readonly suppliers = signal<SupplierRow[]>([]);
  readonly total = signal(0);
  readonly loading = signal(false);
  readonly listError = signal('');

  readonly searchDraft = signal('');
  private readonly searchTerm = signal('');
  private readonly search$ = new Subject<string>();

  readonly activeFilter = signal<'all' | boolean>('all');

  readonly pageIndex = signal(1);
  readonly pageSize = signal(20);

  readonly formOpen = signal(false);
  readonly formSupplier = signal<SupplierRow | null>(null);

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

  onFilterChange(): void {
    this.pageIndex.set(1);
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.listError.set('');
    const skip = (this.pageIndex() - 1) * this.pageSize();
    const af = this.activeFilter();
    this.api
      .list({
        search: this.searchTerm() || undefined,
        skip,
        take: this.pageSize(),
        isActive: af === 'all' ? undefined : af,
      })
      .pipe(first())
      .subscribe({
        next: (res) => {
          this.suppliers.set(res.suppliers);
          this.total.set(res.total);
          this.loading.set(false);
        },
        error: (err: { error?: { message?: string } }) => {
          this.loading.set(false);
          this.listError.set(err?.error?.message ?? this.t('SUPPLIERS.ERROR_LOAD'));
        },
      });
  }

  openCreate(): void {
    this.formSupplier.set(null);
    this.formOpen.set(true);
  }

  openEdit(row: SupplierRow): void {
    this.formSupplier.set(row);
    this.formOpen.set(true);
  }

  closeForm(): void {
    this.formOpen.set(false);
    this.formSupplier.set(null);
  }

  onFormSaved(): void {
    this.closeForm();
    this.load();
  }

  onToggleStatus(row: SupplierRow): void {
    this.confirmation
      .confirm({
        title: row.isActive
          ? this.t('SUPPLIERS.CONFIRM_DEACTIVATE_TITLE')
          : this.t('SUPPLIERS.CONFIRM_ACTIVATE_TITLE'),
        message: this.t('SUPPLIERS.CONFIRM_TOGGLE_MESSAGE', { name: row.name }),
        confirmText: this.t('COMMON.CONFIRM'),
        cancelText: this.t('COMMON.CANCEL'),
        confirmDanger: !row.isActive,
      })
      .pipe(first())
      .subscribe((confirmed) => {
        if (confirmed) {
          this.api
            .toggleStatus(row.id, !row.isActive)
            .pipe(first())
            .subscribe({
              next: () => this.load(),
              error: () => this.load(),
            });
        }
      });
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
