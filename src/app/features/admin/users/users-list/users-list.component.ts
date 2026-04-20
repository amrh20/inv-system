import { DatePipe } from '@angular/common';
import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { EMPTY, Subject } from 'rxjs';
import {
  debounceTime,
  distinctUntilChanged,
  finalize,
  first,
  switchMap,
  tap,
} from 'rxjs/operators';
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
import { NzTooltipModule } from 'ng-zorro-antd/tooltip';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { LucideAngularModule } from 'lucide-angular';
import { Calendar, Eye, EyeOff, Mail, Pencil, Phone, Plus, RefreshCw, Search, Shield, Users, X } from 'lucide-angular';
import { ConfirmationService } from '../../../../core/services/confirmation.service';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { StatusToggleComponent } from '../../../../shared/components/status-toggle/status-toggle.component';
import type { UserRole } from '../../../../core/models/enums';
import { AuthService } from '../../../../core/services/auth.service';
import {
  ASSIGNABLE_USER_ROLES,
  type EmailPickOption,
  type ExistingUserSearchHit,
  type UserCreatePayload,
  type UserListRow,
} from '../../models/admin.models';
import { UsersAdminService } from '../../services/users-admin.service';
import { DepartmentsService } from '../../../master-data/services/departments.service';
import type { DepartmentRow } from '../../../master-data/models/department.model';
import { injectMatchMinWidth } from '../../../../shared/utils/viewport-media';

@Component({
  selector: 'app-users-list',
  standalone: true,
  providers: [ConfirmationService],
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
    NzTooltipModule,
    TranslatePipe,
    LucideAngularModule,
    EmptyStateComponent,
    StatusToggleComponent,
  ],
  templateUrl: './users-list.component.html',
  styleUrl: './users-list.component.scss',
})
export class UsersListComponent implements OnInit {
  private static readonly USERS_COMPANY_MANAGE_PERMISSION = 'USERS_COMPANY_MANAGE';

  private readonly api = inject(UsersAdminService);
  private readonly departmentsApi = inject(DepartmentsService);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);
  private readonly auth = inject(AuthService);
  private readonly confirmation = inject(ConfirmationService);
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
  readonly lucideEye = Eye;
  readonly lucideEyeOff = EyeOff;

  readonly assignableRoles = ASSIGNABLE_USER_ROLES;

  private readonly viewportIsDesktop = injectMatchMinWidth(768);

  readonly nzTableScroll = computed(() =>
    this.viewportIsDesktop() ? {} : { x: '1400px' },
  );

  /** Modal `nz-select` overlays: cap height so the option list scrolls instead of clipping the viewport. */
  readonly modalSelectDropdownStyle: { maxHeight: string; overflowY: string } = {
    maxHeight: 'min(256px, 45vh)',
    overflowY: 'auto',
  };

  readonly users = signal<UserListRow[]>([]);
  readonly total = signal(0);
  readonly maxUsers = signal<number | null>(null);
  /** Active seats from list `meta.totalActiveUsers` (plan usage numerator). */
  readonly totalActiveUsers = signal(0);
  readonly deactivateFreesPlanSlotHint = signal<string | null>(null);
  readonly loading = signal(false);
  readonly listError = signal('');
  readonly usagePercent = computed(() => {
    const max = this.maxUsers();
    if (!max || max <= 0) {
      return 0;
    }
    return Math.min(100, (this.totalActiveUsers() / max) * 100);
  });
  readonly usageTagColor = computed(() => {
    if (this.isLimitReached()) {
      return 'red';
    }
    if (this.usagePercent() >= 80) {
      return 'orange';
    }
    return 'green';
  });
  readonly createLimitReached = computed(() => this.isLimitReached());
  readonly statusUpdatingIds = signal<string[]>([]);

  readonly searchDraft = signal('');
  private readonly searchTerm = signal('');
  private readonly search$ = new Subject<string>();
  private readonly createEmailSearch$ = new Subject<string>();

  readonly roleFilter = signal<UserRole | ''>('');
  readonly pageIndex = signal(1);
  readonly pageSize = signal(20);
  readonly departments = signal<DepartmentRow[]>([]);
  readonly departmentsLoading = signal(false);
  private departmentLoadCompleteCallbacks: (() => void)[] = [];

  readonly modalOpen = signal(false);
  readonly saving = signal(false);
  readonly editRow = signal<UserListRow | null>(null);
  readonly showPassword = signal(false);

  /** Create modal: selected email option (existing user import vs new email). */
  emailPick: EmailPickOption | null = null;
  readonly isImporting = signal(false);
  readonly emailSelectOptions = signal<EmailPickOption[]>([]);
  readonly emailSearchLoading = signal(false);

  /** Server-side search: do not filter options client-side. */
  readonly emailSelectShowAllOptions = (): boolean => true;

  readonly compareEmailPick = (
    a: EmailPickOption | null | undefined,
    b: EmailPickOption | null | undefined,
  ): boolean => {
    if (a == null && b == null) {
      return true;
    }
    if (a == null || b == null) {
      return false;
    }
    return a.source === b.source && a.email.toLowerCase() === b.email.toLowerCase();
  };

  formFirstName = '';
  formLastName = '';
  formEmail = '';
  formPassword = '';
  formRole: UserRole = 'STOREKEEPER';
  formDepartmentId = '';
  formPhone = '';
  formActive = true;
  formError = '';
  private createEmailQuery = '';

  /** Create modal: when true, email comes from platform user search (`nz-select`); when false, free-text new email. */
  isExistingUser = false;

  ngOnInit(): void {
    this.search$
      .pipe(debounceTime(300), takeUntilDestroyed(this.destroyRef))
      .subscribe((q) => {
        this.searchTerm.set(q);
        this.pageIndex.set(1);
        this.load();
      });
    this.createEmailSearch$
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        switchMap((raw) => {
          const q = (raw ?? '').trim();
          if (q.length < 3) {
            this.emailSelectOptions.set([]);
            return EMPTY;
          }
          this.emailSearchLoading.set(true);
          return this.api.searchExistingByEmail(q).pipe(
            finalize(() => this.emailSearchLoading.set(false)),
            tap((hits) => this.buildCreateEmailOptions(hits)),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
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

  t(key: string, params?: Record<string, unknown>): string {
    return this.translate.instant(key, params);
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
          this.maxUsers.set(res.maxUsers);
          this.totalActiveUsers.set(res.totalActiveUsers);
          this.deactivateFreesPlanSlotHint.set(res.deactivateFreesPlanSlotHint);
          this.loading.set(false);
        },
        error: (err: { error?: { message?: string } }) => {
          this.loading.set(false);
          this.listError.set(err?.error?.message ?? this.t('USERS.ERRORS.LOAD'));
        },
      });
  }

  openCreate(): void {
    if (this.createLimitReached()) {
      return;
    }
    this.editRow.set(null);
    this.resetForm();
    this.formError = '';
    this.showPassword.set(false);
    this.modalOpen.set(true);
  }

  openEdit(row: UserListRow): void {
    this.editRow.set(row);
    this.isExistingUser = false;
    this.emailPick = null;
    this.isImporting.set(false);
    this.emailSelectOptions.set([]);
    this.formFirstName = row.firstName ?? '';
    this.formLastName = row.lastName ?? '';
    this.formEmail = row.email;
    this.formPassword = '';
    this.formRole = row.role;
    const hadDepartmentId = !!row.departmentId;
    this.formDepartmentId = row.departmentId ?? '';
    this.formPhone = row.phone ?? '';
    this.formActive = row.isActive !== false;
    this.formError = '';
    this.showPassword.set(false);
    this.modalOpen.set(true);
    this.loadDepartments(() => {
      if (!hadDepartmentId && row.department?.trim()) {
        this.formDepartmentId = this.resolveDepartmentId(row);
      }
    });
  }

  onModalVisible(v: boolean): void {
    this.modalOpen.set(v);
    if (!v) {
      this.editRow.set(null);
      this.showPassword.set(false);
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
    this.formDepartmentId = '';
    this.formPhone = '';
    this.formActive = true;
    this.isExistingUser = false;
    this.emailPick = null;
    this.isImporting.set(false);
    this.emailSelectOptions.set([]);
    this.createEmailQuery = '';
    this.showPassword.set(false);
  }

  togglePasswordVisibility(): void {
    this.showPassword.update((value) => !value);
  }

  /** Clears email / import state when switching between new email and link-existing modes. */
  onLinkExistingUserChange(linkExisting: boolean): void {
    this.isExistingUser = linkExisting;
    this.emailPick = null;
    this.createEmailQuery = '';
    this.emailSelectOptions.set([]);
    this.formEmail = '';
    this.formPassword = '';
    this.isImporting.set(false);
    this.formFirstName = '';
    this.formLastName = '';
    this.formPhone = '';
  }

  onCreateEmailSearch(value: string): void {
    const nextQuery = (value ?? '').trim();
    if (nextQuery) {
      this.createEmailQuery = nextQuery;
    }
    this.createEmailSearch$.next(value ?? '');
  }

  onCreateEmailPickChange(opt: EmailPickOption | null): void {
    this.emailPick = opt;
    if (!opt) {
      this.isImporting.set(false);
      this.formEmail = '';
      this.createEmailQuery = '';
      return;
    }
    this.formEmail = opt.email.trim();
    this.createEmailQuery = this.formEmail;
    if (opt.source === 'existing') {
      this.isImporting.set(true);
      this.formFirstName = opt.user.firstName ?? '';
      this.formLastName = opt.user.lastName ?? '';
      this.formPhone = opt.user.phone ?? '';
      this.formPassword = '';
    } else {
      this.isImporting.set(false);
      this.formFirstName = '';
      this.formLastName = '';
      this.formPhone = '';
    }
  }

  emailPickTrack(_index: number, opt: EmailPickOption): string {
    return `${opt.source}:${opt.email.toLowerCase()}`;
  }

  emailOptionLabel(opt: EmailPickOption): string {
    if (opt.source === 'existing') {
      const u = opt.user;
      const name = `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim();
      return name ? `${u.email} (${name})` : u.email;
    }
    return opt.email;
  }

  private buildCreateEmailOptions(hits: ExistingUserSearchHit[]): void {
    const options: EmailPickOption[] = hits.map((user) => ({
      source: 'existing' as const,
      email: user.email,
      user,
    }));
    this.emailSelectOptions.set(options);
  }

  saveUser(): void {
    const isEdit = !!this.editRow();
    if (!isEdit && this.isExistingUser && !this.isImporting()) {
      this.formError = this.t('USERS.ERRORS.EXISTING_USER_REQUIRED');
      return;
    }
    if (!this.formFirstName.trim() || !this.formEmail.trim()) {
      this.formError = this.t('USERS.ERRORS.NAME_EMAIL');
      return;
    }
    if (!isEdit && !this.isImporting() && !this.formPassword) {
      this.formError = this.t('USERS.ERRORS.PASSWORD_REQUIRED');
      return;
    }
    if (this.formRole === 'DEPT_MANAGER' && !this.formDepartmentId) {
      this.formError = this.t('USERS.ERRORS.DEPARTMENT_REQUIRED');
      return;
    }
    this.formError = '';
    const payload: UserCreatePayload = {
      firstName: this.formFirstName.trim(),
      lastName: this.formLastName.trim(),
      email: this.formEmail.trim(),
      role: this.formRole,
      departmentId: this.formDepartmentId || undefined,
      phone: this.formPhone.trim() || undefined,
    };
    if (isEdit) {
      if (this.formPassword) {
        payload.password = this.formPassword;
      }
    } else if (!this.isImporting() && this.formPassword) {
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
      error: (err: unknown) => {
        this.saving.set(false);
        const msg = this.resolveUserMutationError(err, 'save');
        if (this.isActiveSeatRoleConflict(err)) {
          this.message.error(msg);
          this.formError = '';
        } else {
          this.formError = msg;
        }
      },
    });
  }

  onToggleStatusClick(row: UserListRow): void {
    if (this.isStatusUpdating(row.id)) {
      return;
    }
    const baseMessage = this.t('USERS.CONFIRM_TOGGLE_MESSAGE', {
      action: this.t(row.isActive ? 'COMMON.DEACTIVATE' : 'COMMON.ACTIVATE'),
    });
    const hint = row.isActive ? this.deactivateFreesPlanSlotHint() : null;
    const message =
      row.isActive && hint?.trim() ? `${baseMessage}\n\n${hint.trim()}` : baseMessage;

    this.confirmation
      .confirm({
        title: row.isActive ? this.t('USERS.CONFIRM_DEACTIVATE_TITLE') : this.t('USERS.CONFIRM_ACTIVATE_TITLE'),
        message,
        confirmText: this.t(row.isActive ? 'COMMON.DEACTIVATE' : 'COMMON.ACTIVATE'),
        cancelText: this.t('COMMON.CANCEL'),
        confirmDanger: row.isActive,
      })
      .pipe(first())
      .subscribe((confirmed) => {
        if (!confirmed) {
          return;
        }
        this.setStatusUpdating(row.id, true);
        const payload: UserCreatePayload = {
          firstName: row.firstName?.trim() ?? '',
          lastName: row.lastName?.trim() ?? '',
          email: row.email?.trim() ?? '',
          role: row.role,
          departmentId: row.departmentId ?? undefined,
          phone: row.phone?.trim() || undefined,
          isActive: !row.isActive,
        };
        this.api
          .update(row.id, payload)
          .pipe(first())
          .subscribe({
            next: () => {
              this.setStatusUpdating(row.id, false);
              this.message.success(this.t(row.isActive ? 'USERS.MSG.DEACTIVATED' : 'USERS.MSG.ACTIVATED'));
              this.load();
            },
            error: (err: unknown) => {
              this.setStatusUpdating(row.id, false);
              this.refreshUserRowInTable(row.id);
              const msg = this.resolveUserMutationError(err, 'toggle');
              this.message.error(msg);
            },
          });
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
      case 'AUDITOR':
        return 'default';
      case 'SECURITY':
        return 'volcano';
      case 'GENERAL_MANAGER':
        return 'geekblue';
      default:
        return 'default';
    }
  }

  initials(row: UserListRow): string {
    const a = (row.firstName?.[0] ?? '').toUpperCase();
    const b = (row.lastName?.[0] ?? '').toUpperCase();
    return (a + b).slice(0, 2) || '?';
  }

  canManageCompanyUsers(): boolean {
    return this.auth.hasPermission(UsersListComponent.USERS_COMPANY_MANAGE_PERMISSION);
  }

  /** Only department managers must have a department; other roles (including GENERAL_MANAGER) are optional. */
  isDepartmentRequired(): boolean {
    return this.formRole === 'DEPT_MANAGER';
  }

  isLimitReached(): boolean {
    const max = this.maxUsers();
    if (max == null) {
      return false;
    }
    return this.totalActiveUsers() >= max;
  }

  isStatusUpdating(userId: string): boolean {
    return this.statusUpdatingIds().includes(userId);
  }

  private setStatusUpdating(userId: string, updating: boolean): void {
    const current = this.statusUpdatingIds();
    if (updating) {
      if (!current.includes(userId)) {
        this.statusUpdatingIds.set([...current, userId]);
      }
      return;
    }
    this.statusUpdatingIds.set(current.filter((id) => id !== userId));
  }

  onDepartmentSelectOpen(open: boolean): void {
    if (open) {
      this.loadDepartments();
    }
  }

  private loadDepartments(onComplete?: () => void): void {
    if (onComplete) {
      this.departmentLoadCompleteCallbacks.push(onComplete);
    }
    if (this.departmentsLoading()) {
      return;
    }
    this.departmentsLoading.set(true);
    this.departmentsApi
      .list({ take: 200, isActive: true })
      .pipe(
        first(),
        finalize(() => {
          this.departmentsLoading.set(false);
          const callbacks = [...this.departmentLoadCompleteCallbacks];
          this.departmentLoadCompleteCallbacks = [];
          for (const cb of callbacks) {
            cb();
          }
        }),
      )
      .subscribe({
        next: (res) => this.departments.set(res.departments ?? []),
        error: () => this.departments.set([]),
      });
  }

  private refreshUserRowInTable(userId: string): void {
    this.users.update((list) =>
      list.map((u) => (u.id === userId ? { ...u } : u)),
    );
  }

  private isActiveSeatRoleConflict(err: unknown): boolean {
    const http = err as {
      status?: number;
      error?: { message?: string | string[]; code?: string; statusCode?: number };
    };
    const status = http.status ?? http.error?.statusCode;
    if (status !== 400) {
      return false;
    }
    const code = (http.error?.code ?? '').toString().toUpperCase();
    if (
      code === 'ROLE_UNIQUE_ACTIVE' ||
      code === 'UNIQUE_ACTIVE_ROLE' ||
      code === 'ACTIVE_ROLE_ALREADY_ASSIGNED'
    ) {
      return true;
    }
    const raw = http.error?.message;
    const msg = (Array.isArray(raw) ? raw.join(' ') : (raw ?? '')).toLowerCase();
    return (
      msg.includes('already') &&
      msg.includes('assigned') &&
      (msg.includes('active') || msg.includes('role'))
    );
  }

  private resolveUserMutationError(err: unknown, context: 'toggle' | 'save'): string {
    if (this.isActiveSeatRoleConflict(err)) {
      return this.t('USERS.ERRORS.ROLE_UNIQUE_ACTIVE');
    }
    const http = err as { error?: { message?: string | string[] }; message?: string };
    const raw = http?.error?.message;
    const fromBody = Array.isArray(raw) ? raw.join(' ') : raw;
    return (
      fromBody ??
      http?.message ??
      (context === 'toggle' ? this.t('USERS.ERRORS.STATUS_UPDATE') : this.t('USERS.ERRORS.SAVE'))
    );
  }

  private resolveDepartmentId(row: UserListRow): string {
    if (row.departmentId) {
      return row.departmentId;
    }
    const departmentName = row.department?.trim().toLowerCase();
    if (!departmentName) {
      return '';
    }
    const match = this.departments().find((department) => department.name.trim().toLowerCase() === departmentName);
    return match?.id ?? '';
  }
}
