import { NgClass } from '@angular/common';
import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { first, map } from 'rxjs/operators';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDropdownModule } from 'ng-zorro-antd/dropdown';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzMenuModule } from 'ng-zorro-antd/menu';
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
import { DepartmentFormComponent } from '../department-form/department-form.component';
import type { DepartmentRow } from '../../models/department.model';
import { BaseMasterDataController } from '../../shared/base-master-data.controller';
import { isReferentialIntegrityError } from '../../shared/master-data-error.util';
import { DepartmentsService } from '../../services/departments.service';

@Component({
  selector: 'app-departments-list',
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
    NzTableModule,
    TranslatePipe,
    LucideAngularModule,
    EmptyStateComponent,
    StatusToggleComponent,
    DepartmentFormComponent,
    HasPermissionDirective,
  ],
  templateUrl: './departments-list.component.html',
  styleUrl: './departments-list.component.scss',
})
export class DepartmentsListComponent implements OnInit {
  private readonly api = inject(DepartmentsService);
  private readonly auth = inject(AuthService);
  private readonly confirmation = inject(ConfirmationService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly translate = inject(TranslateService);
  private readonly message = inject(NzMessageService);

  protected readonly canEditBasicData = computed(() => this.auth.hasPermission('BASIC_DATA_EDIT'));

  readonly lucidePlus = Plus;
  readonly lucideSearch = Search;
  readonly lucidePencil = Pencil;
  readonly lucideTrash = Trash2;
  readonly lucideEllipsisVertical = EllipsisVertical;

  private readonly controller = new BaseMasterDataController<DepartmentRow>(
    this.destroyRef,
    (params) => this.api.list({
        search: params.search,
        skip: params.skip,
        take: params.take,
      }).pipe(map((res) => ({ items: res.departments, total: res.total }))),
    () => this.t('DEPARTMENTS.ERROR_LOAD'),
    25,
  );
  readonly departments = this.controller.rows;
  readonly total = this.controller.total;
  readonly loading = this.controller.loading;
  readonly listError = this.controller.listError;
  readonly searchDraft = this.controller.searchDraft;
  readonly pageIndex = this.controller.pageIndex;
  readonly pageSize = this.controller.pageSize;

  readonly formOpen = signal(false);
  readonly formDepartment = signal<DepartmentRow | null>(null);

  ngOnInit(): void {
    this.controller.load();
  }

  onSearchChange(value: string): void {
    this.controller.onSearchChange(value);
  }

  load(): void {
    this.controller.load();
  }

  openCreate(): void {
    this.formDepartment.set(null);
    this.formOpen.set(true);
  }

  openEdit(row: DepartmentRow): void {
    this.formDepartment.set(row);
    this.formOpen.set(true);
  }

  closeForm(): void {
    this.formOpen.set(false);
    this.formDepartment.set(null);
  }

  onFormSaved(): void {
    this.closeForm();
    this.load();
  }

  onToggleStatus(row: DepartmentRow): void {
    const prev = row.isActive;
    this.departments.update((items) => items.map((d) => (d.id === row.id ? { ...d, isActive: !prev } : d)));
    this.confirmation
      .confirm({
        title: prev
          ? this.t('DEPARTMENTS.CONFIRM_DEACTIVATE_TITLE')
          : this.t('DEPARTMENTS.CONFIRM_ACTIVATE_TITLE'),
        message: this.t('DEPARTMENTS.CONFIRM_TOGGLE_MESSAGE', { name: row.name }),
        confirmText: this.t('COMMON.CONFIRM'),
        cancelText: this.t('COMMON.CANCEL'),
        confirmDanger: !prev,
      })
      .pipe(first())
      .subscribe((confirmed) => {
        if (!confirmed) {
          this.departments.update((items) => items.map((d) => (d.id === row.id ? { ...d, isActive: prev } : d)));
          return;
        }
        this.api
          .toggleActive(row.id)
          .pipe(first())
          .subscribe({
            error: (err) => {
              this.departments.update((items) => items.map((d) => (d.id === row.id ? { ...d, isActive: prev } : d)));
              this.message.error(err?.error?.message ?? this.t('DEPARTMENTS.ERROR_LOAD'));
            },
          });
      });
  }

  onDeleteClick(row: DepartmentRow): void {
    if (!this.canDelete(row)) return;
    this.confirmation
      .confirm({
        title: this.t('DEPARTMENTS.CONFIRM_DELETE_TITLE'),
        message: this.t('DEPARTMENTS.CONFIRM_DELETE_MESSAGE', { name: row.name }),
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
            .subscribe({
              next: () => this.load(),
              error: (err) => {
                this.load();
                if (isReferentialIntegrityError(err) || err?.status === 400 || err?.status === 403) {
                  this.message.error(this.t('COMMON.RECORD_IN_USE'));
                  return;
                }
                this.message.error(err?.error?.message ?? this.t('DEPARTMENTS.ERROR_DELETE'));
              },
            });
        }
      });
  }

  onPageIndexChange(i: number): void {
    this.controller.onPageIndexChange(i);
  }

  onPageSizeChange(n: number): void {
    this.controller.onPageSizeChange(n);
  }

  canDelete(row: DepartmentRow): boolean {
    return (row._count?.locations ?? 0) === 0;
  }

  private t(key: string, params?: Record<string, unknown>): string {
    return this.translate.instant(key, params);
  }
}
