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
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { LucideAngularModule } from 'lucide-angular';
import { EllipsisVertical, Pencil, Plus, Search, Trash2 } from 'lucide-angular';
import { HasPermissionDirective } from '../../../../core/directives/has-permission.directive';
import { AuthService } from '../../../../core/services/auth.service';
import { ConfirmationService } from '../../../../core/services/confirmation.service';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { ItemMasterLookupsService } from '../../../items/services/item-master-lookups.service';
import { CategoryFormComponent } from '../category-form/category-form.component';
import { SubcategoryFormComponent } from '../subcategory-form/subcategory-form.component';
import type { CategoryRow, SubcategoryRow } from '../../models/category.model';
import { CategoriesService } from '../../services/categories.service';

@Component({
  selector: 'app-categories-list',
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
    CategoryFormComponent,
    SubcategoryFormComponent,
    HasPermissionDirective,
  ],
  templateUrl: './categories-list.component.html',
  styleUrl: './categories-list.component.scss',
})
export class CategoriesListComponent implements OnInit {
  private readonly api = inject(CategoriesService);
  private readonly auth = inject(AuthService);
  private readonly lookups = inject(ItemMasterLookupsService);
  private readonly confirmation = inject(ConfirmationService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly translate = inject(TranslateService);

  /** Main table column count; actions column hidden without `BASIC_DATA_EDIT`. */
  protected readonly basicDataTableColspan = computed(() =>
    this.auth.hasPermission('BASIC_DATA_EDIT') ? 7 : 6,
  );

  readonly lucidePlus = Plus;
  readonly lucideSearch = Search;
  readonly lucidePencil = Pencil;
  readonly lucideTrash = Trash2;
  readonly lucideEllipsisVertical = EllipsisVertical;

  readonly expandedIds = signal<Set<string>>(new Set());

  readonly categories = signal<CategoryRow[]>([]);
  readonly total = signal(0);
  readonly loading = signal(false);
  readonly listError = signal('');
  readonly departments = signal<{ id: string; name: string }[]>([]);

  readonly searchDraft = signal('');
  private readonly searchTerm = signal('');
  private readonly search$ = new Subject<string>();
  readonly departmentId = signal<string | null>(null);

  readonly pageIndex = signal(1);
  readonly pageSize = signal(50);

  readonly formOpen = signal(false);
  readonly formCategory = signal<CategoryRow | null>(null);

  readonly subFormOpen = signal(false);
  readonly subFormCategoryId = signal<string>('');
  readonly subFormSubcategory = signal<SubcategoryRow | null>(null);

  ngOnInit(): void {
    this.search$
      .pipe(debounceTime(300), takeUntilDestroyed(this.destroyRef))
      .subscribe((q) => {
        this.searchTerm.set(q);
        this.pageIndex.set(1);
        this.load();
      });
    this.lookups
      .listDepartments({ take: 200 })
      .pipe(first())
      .subscribe({ next: (d) => this.departments.set(d), error: () => this.departments.set([]) });
    this.load();
  }

  onSearchChange(value: string): void {
    this.searchDraft.set(value);
    this.search$.next(value.trim());
  }

  onDepartmentChange(): void {
    this.pageIndex.set(1);
    this.load();
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
        departmentId: this.departmentId() || undefined,
      })
      .pipe(first())
      .subscribe({
        next: (res) => {
          this.categories.set(res.categories);
          this.total.set(res.total);
          this.loading.set(false);
        },
        error: (err: { error?: { message?: string } }) => {
          this.loading.set(false);
          this.listError.set(err?.error?.message ?? this.t('CATEGORIES.ERROR_LOAD'));
        },
      });
  }

  openCreate(): void {
    this.formCategory.set(null);
    this.formOpen.set(true);
  }

  openEdit(row: CategoryRow): void {
    this.formCategory.set(row);
    this.formOpen.set(true);
  }

  closeForm(): void {
    this.formOpen.set(false);
    this.formCategory.set(null);
  }

  onFormSaved(): void {
    this.closeForm();
    this.load();
  }

  openAddSubcategory(cat: CategoryRow): void {
    this.subFormCategoryId.set(cat.id);
    this.subFormSubcategory.set(null);
    this.subFormOpen.set(true);
  }

  openEditSubcategory(cat: CategoryRow, sub: SubcategoryRow): void {
    this.subFormCategoryId.set(cat.id);
    this.subFormSubcategory.set(sub);
    this.subFormOpen.set(true);
  }

  closeSubForm(): void {
    this.subFormOpen.set(false);
    this.subFormCategoryId.set('');
    this.subFormSubcategory.set(null);
  }

  onSubFormSaved(): void {
    this.closeSubForm();
    this.load();
  }

  onDeleteCategory(row: CategoryRow): void {
    this.confirmation
      .confirm({
        title: this.t('CATEGORIES.CONFIRM_DELETE_TITLE'),
        message: this.t('CATEGORIES.CONFIRM_DELETE_MESSAGE', { name: row.name }),
        confirmText: this.t('COMMON.DELETE'),
        cancelText: this.t('COMMON.CANCEL'),
        confirmDanger: true,
      })
      .pipe(first())
      .subscribe((confirmed) => {
        if (confirmed) {
          this.api
            .delete(row.id)
            .pipe(first())
            .subscribe({ next: () => this.load(), error: () => this.load() });
        }
      });
  }

  onDeleteSubcategory(sub: SubcategoryRow): void {
    this.confirmation
      .confirm({
        title: this.t('CATEGORIES.CONFIRM_DELETE_SUBCATEGORY_TITLE'),
        message: this.t('CATEGORIES.CONFIRM_DELETE_SUBCATEGORY_MESSAGE', { name: sub.name }),
        confirmText: this.t('COMMON.DELETE'),
        cancelText: this.t('COMMON.CANCEL'),
        confirmDanger: true,
      })
      .pipe(first())
      .subscribe((confirmed) => {
        if (confirmed) {
          this.api
            .deleteSubcategory(sub.id)
            .pipe(first())
            .subscribe({ next: () => this.load(), error: () => this.load() });
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

  toggleExpand(id: string): void {
    this.expandedIds.update((set) => {
      const next = new Set(set);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  hasSubcategories(row: CategoryRow): boolean {
    return (row.subcategories?.length ?? 0) > 0;
  }

  private t(key: string, params?: Record<string, unknown>): string {
    return this.translate.instant(key, params);
  }
}
