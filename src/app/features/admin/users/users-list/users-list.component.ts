import { DatePipe } from '@angular/common';
import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { debounceTime, first } from 'rxjs/operators';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzAvatarModule } from 'ng-zorro-antd/avatar';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { LucideAngularModule } from 'lucide-angular';
import { Calendar, Mail, Pencil, Phone, Plus, RefreshCw, Search, Shield, Users, X } from 'lucide-angular';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import type { UserRole } from '../../../../core/models/enums';
import { ASSIGNABLE_USER_ROLES, type UserCreatePayload, type UserListRow } from '../../models/admin.models';
import { UsersAdminService } from '../../services/users-admin.service';

@Component({
  selector: 'app-users-list',
  standalone: true,
  imports: [
    DatePipe,
    FormsModule,
    NzAlertModule,
    NzAvatarModule,
    NzButtonModule,
    NzCheckboxModule,
    NzInputModule,
    NzModalModule,
    NzSelectModule,
    NzSpinModule,
    NzTableModule,
    NzTagModule,
    TranslatePipe,
    LucideAngularModule,
    EmptyStateComponent,
  ],
  templateUrl: './users-list.component.html',
  styleUrl: './users-list.component.scss',
})
export class UsersListComponent implements OnInit {
  private readonly api = inject(UsersAdminService);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);

  readonly lucideUsers = Users;
  readonly lucidePlus = Plus;
  readonly lucideSearch = Search;
  readonly lucideX = X;
  readonly lucideRefresh = RefreshCw;
  readonly lucideMail = Mail;
  readonly lucideShield = Shield;
  readonly lucidePhone = Phone;
  readonly lucideCalendar = Calendar;
  readonly lucidePencil = Pencil;

  readonly assignableRoles = ASSIGNABLE_USER_ROLES;

  readonly users = signal<UserListRow[]>([]);
  readonly total = signal(0);
  readonly loading = signal(false);
  readonly listError = signal('');

  readonly searchDraft = signal('');
  private readonly searchTerm = signal('');
  private readonly search$ = new Subject<string>();

  readonly roleFilter = signal<UserRole | ''>('');
  readonly pageIndex = signal(1);
  readonly pageSize = signal(20);

  readonly modalOpen = signal(false);
  readonly saving = signal(false);
  readonly editRow = signal<UserListRow | null>(null);

  formFirstName = '';
  formLastName = '';
  formEmail = '';
  formPassword = '';
  formRole: UserRole = 'STOREKEEPER';
  formDepartment = '';
  formPhone = '';
  formActive = true;
  formError = '';

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

  onRoleFilterChange(value: UserRole | ''): void {
    this.roleFilter.set(value);
    this.pageIndex.set(1);
    this.load();
  }

  t(key: string): string {
    return this.translate.instant(key);
  }

  load(): void {
    this.loading.set(true);
    this.listError.set('');
    const rf = this.roleFilter();
    this.api
      .list({
        page: this.pageIndex(),
        limit: this.pageSize(),
        search: this.searchTerm() || undefined,
        role: rf || undefined,
      })
      .pipe(first())
      .subscribe({
        next: (res) => {
          this.users.set(res.users);
          this.total.set(res.total);
          this.loading.set(false);
        },
        error: (err: { error?: { message?: string } }) => {
          this.loading.set(false);
          this.listError.set(err?.error?.message ?? this.t('USERS.ERRORS.LOAD'));
        },
      });
  }

  openCreate(): void {
    this.editRow.set(null);
    this.resetForm();
    this.formError = '';
    this.modalOpen.set(true);
  }

  openEdit(row: UserListRow): void {
    this.editRow.set(row);
    this.formFirstName = row.firstName ?? '';
    this.formLastName = row.lastName ?? '';
    this.formEmail = row.email;
    this.formPassword = '';
    this.formRole = row.role;
    this.formDepartment = row.department ?? '';
    this.formPhone = row.phone ?? '';
    this.formActive = row.isActive !== false;
    this.formError = '';
    this.modalOpen.set(true);
  }

  onModalVisible(v: boolean): void {
    this.modalOpen.set(v);
    if (!v) {
      this.editRow.set(null);
    }
  }

  closeModal(): void {
    this.modalOpen.set(false);
    this.editRow.set(null);
  }

  private resetForm(): void {
    this.formFirstName = '';
    this.formLastName = '';
    this.formEmail = '';
    this.formPassword = '';
    this.formRole = 'STOREKEEPER';
    this.formDepartment = '';
    this.formPhone = '';
    this.formActive = true;
  }

  saveUser(): void {
    const isEdit = !!this.editRow();
    if (!this.formFirstName.trim() || !this.formEmail.trim()) {
      this.formError = this.t('USERS.ERRORS.NAME_EMAIL');
      return;
    }
    if (!isEdit && !this.formPassword) {
      this.formError = this.t('USERS.ERRORS.PASSWORD_REQUIRED');
      return;
    }
    this.formError = '';
    const payload: UserCreatePayload = {
      firstName: this.formFirstName.trim(),
      lastName: this.formLastName.trim(),
      email: this.formEmail.trim(),
      role: this.formRole,
      department: this.formDepartment.trim() || undefined,
      phone: this.formPhone.trim() || undefined,
    };
    if (this.formPassword) {
      payload.password = this.formPassword;
    }
    if (isEdit) {
      payload.isActive = this.formActive;
    }
    this.saving.set(true);
    const req = isEdit
      ? this.api.update(this.editRow()!.id, payload)
      : this.api.create(payload);
    req.pipe(first()).subscribe({
      next: () => {
        this.saving.set(false);
        this.message.success(this.t(isEdit ? 'USERS.MSG.UPDATED' : 'USERS.MSG.CREATED'));
        this.closeModal();
        this.load();
      },
      error: (err: { error?: { message?: string }; message?: string }) => {
        this.saving.set(false);
        this.formError = err?.error?.message ?? err?.message ?? this.t('USERS.ERRORS.SAVE');
      },
    });
  }

  onPageIndexChange(p: number): void {
    this.pageIndex.set(p);
    this.load();
  }

  onPageSizeChange(s: number): void {
    this.pageSize.set(s);
    this.pageIndex.set(1);
    this.load();
  }

  clearFilters(): void {
    this.searchDraft.set('');
    this.searchTerm.set('');
    this.roleFilter.set('');
    this.pageIndex.set(1);
    this.load();
  }

  roleNzColor(role: UserRole): string {
    switch (role) {
      case 'ADMIN':
        return 'red';
      case 'STOREKEEPER':
        return 'blue';
      case 'DEPT_MANAGER':
        return 'purple';
      case 'COST_CONTROL':
        return 'gold';
      case 'FINANCE_MANAGER':
        return 'green';
      default:
        return 'default';
    }
  }

  initials(row: UserListRow): string {
    const a = (row.firstName?.[0] ?? '').toUpperCase();
    const b = (row.lastName?.[0] ?? '').toUpperCase();
    return (a + b).slice(0, 2) || '?';
  }
}
