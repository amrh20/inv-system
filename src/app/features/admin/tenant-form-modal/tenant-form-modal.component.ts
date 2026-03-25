import { CommonModule } from '@angular/common';
import { Component, computed, DestroyRef, effect, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { EMPTY, Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, finalize, switchMap, tap } from 'rxjs/operators';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzGridModule } from 'ng-zorro-antd/grid';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzRadioModule } from 'ng-zorro-antd/radio';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzStepsModule } from 'ng-zorro-antd/steps';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { LucideAngularModule } from 'lucide-angular';
import { Building2, Eye, EyeOff, KeySquare, User } from 'lucide-angular';
import type { PlanType } from '../../../core/models/enums';
import type { EmailPickOption, ExistingUserSearchHit } from '../models/admin.models';
import type {
  CreateFullOrganizationPayload,
  TenantCreateAdminUserPayload,
  TenantCreatePayload,
  TenantUpdatePayload,
} from '../services/tenants.service';
import { TenantsService } from '../services/tenants.service';
import { UsersAdminService } from '../services/users-admin.service';
import type { TenantRow } from '../models/tenant.model';
import { formErrorKeyFromHttp } from '../../../core/utils/http-error.util';

const PLAN_LIMITS: Record<string, number | null> = {
  BASIC: 5,
  PRO: 25,
  ENTERPRISE: 99999,
  CUSTOM: null as unknown as number,
};

/** Organizations default to ACTIVE server-side (no trial). */
const DEFAULT_ORG_SUB_STATUS = 'ACTIVE';

@Component({
  selector: 'app-tenant-form-modal',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    NzAlertModule,
    NzButtonModule,
    NzFormModule,
    NzGridModule,
    NzInputModule,
    NzDatePickerModule,
    NzModalModule,
    NzRadioModule,
    NzSelectModule,
    NzStepsModule,
    NzSwitchModule,
    NzTagModule,
    TranslatePipe,
    LucideAngularModule,
  ],
  templateUrl: './tenant-form-modal.component.html',
  styleUrl: './tenant-form-modal.component.scss',
})
export class TenantFormModalComponent {
  private readonly api = inject(TenantsService);
  private readonly usersAdmin = inject(UsersAdminService);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);

  readonly visible = input.required<boolean>();
  readonly tenant = input<TenantRow | null>(null);
  /** When opening the create modal to add a hotel under an existing org (list action). */
  readonly branchParentTenant = input<TenantRow | null>(null);
  readonly saved = output<void>();

  private readonly createEmailSearch$ = new Subject<string>();

  readonly isEditMode = computed(() => !!this.tenant());
  /** New org + first hotel (two-step). */
  readonly createMode = signal<'wizard' | 'branch'>('wizard');
  readonly currentStep = signal(1);
  /** Parent org id when adding a hotel under an existing org (wizard step 2 only). */
  createdOrgId: string | null = null;
  createdOrganizationName = '';

  readonly isWizardFlow = computed(() => !this.isEditMode() && this.createMode() === 'wizard');
  readonly isBranchFlow = computed(() => !this.isEditMode() && this.createMode() === 'branch');

  readonly lucideBuilding2 = Building2;
  readonly lucideKeySquare = KeySquare;
  readonly lucideUser = User;
  readonly lucideEye = Eye;
  readonly lucideEyeOff = EyeOff;

  readonly saving = signal(false);
  readonly loadingParentTenants = signal(false);
  readonly showPassword = signal(false);
  readonly allTenants = signal<TenantRow[]>([]);
  readonly importingExistingAdmin = signal(false);
  readonly emailSelectOptions = signal<EmailPickOption[]>([]);
  readonly emailSearchLoading = signal(false);

  /** Step 2 (wizard): first hotel under the org created in step 1. */
  hotelName = '';
  hotelSlug = '';
  /** Step 2: licensing for the first-hotel tenant (POST child payload). */
  hotelPlanType: PlanType = 'BASIC';
  hotelSubStatus = 'TRIAL';
  hotelMaxUsers = 5;
  hotelLicenseStartDate: Date | null = new Date();
  hotelLicenseEndDate: Date | null = null;
  /** Email of the org manager from wizard step 1 (for "same as organization manager"). */
  wizardOrgManagerEmail = '';
  /** Step 2: who administers the first hotel. */
  hotelAdminMode: 'same' | 'new' = 'same';
  hotelAdminFirstName = '';
  hotelAdminLastName = '';
  hotelAdminEmail = '';
  hotelAdminPassword = '';
  readonly showHotelAdminPassword = signal(false);

  readonly parentTenantOptions = computed(() => {
    const currentId = this.editId;
    return this.allTenants().filter((item) => item.id !== currentId);
  });

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

  name = '';
  slug = '';
  planType: PlanType = 'BASIC';
  subStatus = DEFAULT_ORG_SUB_STATUS;
  maxUsers = 5;
  licenseStartDate: Date | null = new Date();
  licenseEndDate: Date | null = null;
  parentId: string | null = null;
  hasBranches = false;
  maxBranches = 1;
  assignOrgManagersToBranch = true;
  adminFirstName = '';
  adminLastName = '';
  adminEmail = '';
  /** Wizard step 1: initial organization manager phone. */
  adminPhone = '';
  adminPassword = '';
  emailPick: EmailPickOption | null = null;
  formError = '';

  private editId: string | null = null;

  constructor() {
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
          return this.usersAdmin.searchExistingByEmail(q).pipe(
            finalize(() => this.emailSearchLoading.set(false)),
            tap((hits) => this.buildCreateEmailOptions(hits, q)),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();

    effect(() => {
      if (this.visible()) {
        this.loadParentTenantOptions();
        const t = this.tenant();
        if (t) {
          this.patchForEdit(t);
        } else {
          const branchParent = this.branchParentTenant();
          if (branchParent) {
            this.openAsBranch(branchParent);
          } else {
            this.resetForm();
          }
        }
      } else {
        this.formError = '';
      }
    });
  }

  getErrorMessage(): string {
    if (!this.formError) return '';
    if (this.formError.startsWith('SUPER_ADMIN.')) {
      return this.translate.instant(this.formError);
    }
    return this.formError;
  }

  get modalTitle(): string {
    if (this.isEditMode()) {
      return this.translate.instant('SUPER_ADMIN.EDIT_TENANT_TITLE');
    }
    if (this.isWizardFlow() && this.currentStep() === 2 && this.parentId) {
      const orgLabel = this.createdOrganizationName || this.name.trim();
      return this.translate.instant('SUPER_ADMIN.ADD_HOTEL_TO_ORG_TITLE', { name: orgLabel });
    }
    if (this.isWizardFlow() && this.currentStep() === 2) {
      const orgLabel = this.createdOrganizationName || this.name.trim();
      return this.translate.instant('SUPER_ADMIN.WIZARD_FIRST_HOTEL_MODAL_TITLE', {
        name: orgLabel,
      });
    }
    if (this.isWizardFlow() && this.currentStep() === 1) {
      return this.translate.instant('SUPER_ADMIN.CREATE_ORG_TITLE');
    }
    return this.parentId
      ? this.translate.instant('SUPER_ADMIN.CREATE_BRANCH_HOTEL_TITLE')
      : this.translate.instant('SUPER_ADMIN.CREATE_ORG_TITLE');
  }

  get submitLabel(): string {
    if (this.isEditMode()) {
      return this.translate.instant('COMMON.SAVE');
    }
    return this.parentId
      ? this.translate.instant('SUPER_ADMIN.CREATE_SUBMIT_BRANCH')
      : this.translate.instant('SUPER_ADMIN.CREATE_SUBMIT_ORG');
  }

  get isDateRangeInvalid(): boolean {
    if (!this.licenseStartDate || !this.licenseEndDate) {
      return false;
    }
    return this.startOfDay(this.licenseEndDate).getTime() < this.startOfDay(this.licenseStartDate).getTime();
  }

  get isWizardHotelLicenseDateRangeInvalid(): boolean {
    if (!this.hotelLicenseStartDate || !this.hotelLicenseEndDate) {
      return false;
    }
    return (
      this.startOfDay(this.hotelLicenseEndDate).getTime() <
      this.startOfDay(this.hotelLicenseStartDate).getTime()
    );
  }

  readonly disableEndDate = (current: Date): boolean => {
    if (!this.licenseStartDate) {
      return false;
    }
    return this.startOfDay(current).getTime() < this.startOfDay(this.licenseStartDate).getTime();
  };

  readonly disableWizardHotelLicenseEndDate = (current: Date): boolean => {
    if (!this.hotelLicenseStartDate) {
      return false;
    }
    return this.startOfDay(current).getTime() < this.startOfDay(this.hotelLicenseStartDate).getTime();
  };

  private resetWizardHotelLicensingToDefaults(): void {
    this.hotelPlanType = 'BASIC';
    this.hotelSubStatus = 'TRIAL';
    const limit = PLAN_LIMITS[this.hotelPlanType];
    this.hotelMaxUsers = limit != null ? limit : 5;
    this.hotelLicenseStartDate = new Date();
    this.hotelLicenseEndDate = null;
  }

  /**
   * Add a hotel under an existing organization: wizard step 2 only, with parentId and org manager email prefilled.
   */
  openAsBranch(parentOrg: TenantRow): void {
    this.editId = null;
    this.formError = '';
    this.createMode.set('wizard');
    this.currentStep.set(2);
    this.createdOrgId = parentOrg.id;
    this.createdOrganizationName = parentOrg.name?.trim() ?? '';
    this.parentId = parentOrg.id;
    this.wizardOrgManagerEmail = '';

    this.hotelName = '';
    this.hotelSlug = '';
    this.resetWizardHotelLicensingToDefaults();
    this.applyWizardHotelLicenseFromOrgRow(parentOrg);
    this.hotelAdminMode = 'same';
    this.hotelAdminFirstName = '';
    this.hotelAdminLastName = '';
    this.hotelAdminEmail = '';
    this.hotelAdminPassword = '';
    this.showHotelAdminPassword.set(false);

    this.name = '';
    this.slug = '';
    this.planType = 'BASIC';
    this.subStatus = DEFAULT_ORG_SUB_STATUS;
    this.maxUsers = 5;
    this.licenseStartDate = new Date();
    this.licenseEndDate = null;
    this.hasBranches = false;
    this.maxBranches = 0;
    this.assignOrgManagersToBranch = true;
    this.adminFirstName = '';
    this.adminLastName = '';
    this.adminEmail = '';
    this.adminPhone = '';
    this.adminPassword = '';
    this.emailPick = null;
    this.importingExistingAdmin.set(false);
    this.emailSelectOptions.set([]);
  }

  private resetForm(): void {
    this.editId = null;
    this.createMode.set('wizard');
    this.currentStep.set(1);
    this.createdOrgId = null;
    this.createdOrganizationName = '';
    this.hotelName = '';
    this.hotelSlug = '';
    this.resetWizardHotelLicensingToDefaults();
    this.wizardOrgManagerEmail = '';
    this.hotelAdminMode = 'same';
    this.hotelAdminFirstName = '';
    this.hotelAdminLastName = '';
    this.hotelAdminEmail = '';
    this.hotelAdminPassword = '';
    this.showHotelAdminPassword.set(false);
    this.name = '';
    this.slug = '';
    this.planType = 'BASIC';
    this.subStatus = DEFAULT_ORG_SUB_STATUS;
    this.maxUsers = 5;
    this.licenseStartDate = new Date();
    this.licenseEndDate = null;
    this.parentId = null;
    this.hasBranches = false;
    this.maxBranches = 1;
    this.assignOrgManagersToBranch = true;
    this.adminFirstName = '';
    this.adminLastName = '';
    this.adminEmail = '';
    this.adminPhone = '';
    this.adminPassword = '';
    this.emailPick = null;
    this.importingExistingAdmin.set(false);
    this.emailSelectOptions.set([]);
    this.formError = '';
  }

  private patchForEdit(t: TenantRow): void {
    this.editId = t.id;
    this.name = t.name ?? '';
    this.slug = t.slug ?? '';
    this.planType = (t.planType as PlanType) ?? 'BASIC';
    this.subStatus = t.subStatus ?? 'TRIAL';
    this.maxUsers = t.maxUsers ?? 5;
    this.licenseStartDate = t.licenseStartDate ? new Date(t.licenseStartDate) : new Date();
    this.licenseEndDate = t.licenseEndDate ? new Date(t.licenseEndDate) : null;
    this.parentId = t.parentId ?? null;
    this.hasBranches = !!t.hasBranches;
    this.maxBranches = t.maxBranches ?? 0;
    this.adminFirstName = '';
    this.adminLastName = '';
    this.adminEmail = '';
    this.adminPhone = '';
    this.adminPassword = '';
    this.emailPick = null;
    this.importingExistingAdmin.set(false);
    this.emailSelectOptions.set([]);
  }

  switchToBranchMode(): void {
    this.createMode.set('branch');
    this.currentStep.set(1);
    this.createdOrgId = null;
    this.createdOrganizationName = '';
    this.hotelName = '';
    this.hotelSlug = '';
    this.resetWizardHotelLicensingToDefaults();
    this.wizardOrgManagerEmail = '';
    this.hotelAdminMode = 'same';
    this.hotelAdminFirstName = '';
    this.hotelAdminLastName = '';
    this.hotelAdminEmail = '';
    this.hotelAdminPassword = '';
    this.formError = '';
  }

  switchToWizardMode(): void {
    this.createMode.set('wizard');
    this.currentStep.set(1);
    this.createdOrgId = null;
    this.createdOrganizationName = '';
    this.parentId = null;
    this.hotelName = '';
    this.hotelSlug = '';
    this.resetWizardHotelLicensingToDefaults();
    this.wizardOrgManagerEmail = '';
    this.hotelAdminMode = 'same';
    this.hotelAdminFirstName = '';
    this.hotelAdminLastName = '';
    this.hotelAdminEmail = '';
    this.hotelAdminPassword = '';
    this.formError = '';
  }

  onNameChange(): void {
    if (!this.isEditMode() && this.name) {
      this.slug = this.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
    }
  }

  onHotelNameChange(): void {
    if (this.hotelName) {
      this.hotelSlug = this.hotelName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
    }
  }

  onPlanChange(plan: PlanType): void {
    this.planType = plan;
    const limit = PLAN_LIMITS[plan];
    if (limit != null) this.maxUsers = limit;
  }

  onWizardHotelPlanChange(plan: PlanType): void {
    this.hotelPlanType = plan;
    const limit = PLAN_LIMITS[plan];
    if (limit != null) this.hotelMaxUsers = limit;
  }

  onWizardHotelLicenseStartDateChange(date: Date | null): void {
    this.hotelLicenseStartDate = date;
  }

  onParentChange(parentId: string | null): void {
    this.parentId = parentId;
    if (this.parentId) {
      this.hasBranches = false;
      this.maxBranches = 0;
      if (!this.isEditMode()) {
        const parent = this.allTenants().find((t) => t.id === parentId);
        if (parent) {
          this.applyParentLicenseDefaults(parent);
        }
      }
    } else {
      if (!this.isEditMode()) {
        this.planType = 'BASIC';
        this.maxUsers = 5;
        this.subStatus = DEFAULT_ORG_SUB_STATUS;
        this.licenseStartDate = new Date();
        this.licenseEndDate = null;
        this.maxBranches = 1;
      }
      this.assignOrgManagersToBranch = true;
    }
  }

  private applyParentLicenseDefaults(parent: TenantRow): void {
    this.planType = (parent.planType as PlanType) ?? 'BASIC';
    this.maxUsers = parent.maxUsers ?? 5;
    this.subStatus = parent.subStatus ?? 'TRIAL';
    this.licenseStartDate = parent.licenseStartDate ? new Date(parent.licenseStartDate) : new Date();
    this.licenseEndDate = parent.licenseEndDate ? new Date(parent.licenseEndDate) : null;
  }

  onHasBranchesChange(enabled: boolean): void {
    this.hasBranches = enabled && !this.parentId;
    if (!this.hasBranches) {
      this.maxBranches = 0;
    }
  }

  onMaxBranchesChange(value: number | string | null): void {
    const n = typeof value === 'number' ? value : Number(value);
    this.maxBranches = Number.isFinite(n) ? Math.max(1, Math.floor(n)) : 1;
  }

  onLicenseStartDateChange(date: Date | null): void {
    this.licenseStartDate = date;
  }

  private loadParentTenantOptions(): void {
    this.loadingParentTenants.set(true);
    this.api.list({ page: 1, limit: 1000 }).subscribe({
      next: (res) => {
        const rows = res.data ?? [];
        this.allTenants.set(rows);
        if (!this.isEditMode() && this.parentId) {
          const parent = rows.find((t) => t.id === this.parentId);
          if (parent) {
            this.applyParentLicenseDefaults(parent);
          }
        }
        this.loadingParentTenants.set(false);
      },
      error: () => {
        this.allTenants.set([]);
        this.loadingParentTenants.set(false);
      },
    });
  }

  onCreateEmailSearch(value: string): void {
    this.createEmailSearch$.next(value ?? '');
  }

  onCreateEmailPickChange(opt: EmailPickOption | null): void {
    this.emailPick = opt;
    if (!opt) {
      this.adminEmail = '';
      this.adminFirstName = '';
      this.adminLastName = '';
      this.adminPassword = '';
      this.importingExistingAdmin.set(false);
      return;
    }
    this.adminEmail = opt.email.trim();
    if (opt.source === 'existing') {
      this.importingExistingAdmin.set(true);
      this.adminFirstName = opt.user.firstName ?? '';
      this.adminLastName = opt.user.lastName ?? '';
      this.adminPassword = '';
    } else {
      this.importingExistingAdmin.set(false);
      this.adminFirstName = '';
      this.adminLastName = '';
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
    return this.translate.instant('USERS.FORM.NEW_USER_EMAIL_OPTION', { email: opt.email });
  }

  private buildCreateEmailOptions(hits: ExistingUserSearchHit[], query: string): void {
    const options: EmailPickOption[] = hits.map((user) => ({
      source: 'existing' as const,
      email: user.email,
      user,
    }));
    const q = query.trim();
    const qLower = q.toLowerCase();
    const hasExact = hits.some((h) => h.email.toLowerCase() === qLower);
    if (this.looksLikeCompleteEmail(q) && !hasExact) {
      options.push({ source: 'new', email: q });
    }
    this.emailSelectOptions.set(options);
  }

  private looksLikeCompleteEmail(value: string): boolean {
    const v = value.trim();
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
  }

  togglePasswordVisibility(): void {
    this.showPassword.update((v) => !v);
  }

  toggleHotelAdminPasswordVisibility(): void {
    this.showHotelAdminPassword.update((v) => !v);
  }

  close(): void {
    this.saved.emit();
  }

  submit(): void {
    this.formError = '';
    if (this.isDateRangeInvalid) {
      this.formError = 'SUPER_ADMIN.CREATE_LICENSE_DATE_RANGE_INVALID';
      return;
    }
    if (this.isEditMode()) {
      this.submitEdit();
    } else if (this.isBranchFlow()) {
      this.submitCreate();
    }
  }

  submitWizardStep1(): void {
    this.formError = '';
    if (!this.name?.trim() || !this.slug?.trim()) {
      this.formError = 'SUPER_ADMIN.CREATE_VALIDATION';
      return;
    }
    if (!this.adminFirstName?.trim() || !this.adminLastName?.trim() || !this.adminEmail?.trim()) {
      this.formError = 'SUPER_ADMIN.CREATE_VALIDATION';
      return;
    }
    if (!this.adminPhone?.trim()) {
      this.formError = 'SUPER_ADMIN.CREATE_VALIDATION';
      return;
    }
    if (!this.adminPassword || this.adminPassword.length < 8) {
      this.formError = 'SUPER_ADMIN.CREATE_PASSWORD_MIN';
      return;
    }

    this.createdOrganizationName = this.name.trim();
    this.wizardOrgManagerEmail = this.adminEmail.trim();
    this.currentStep.set(2);
  }

  wizardGoBackToStep1(): void {
    if (this.saving()) {
      return;
    }
    if (this.parentId) {
      return;
    }
    this.formError = '';
    this.currentStep.set(1);
  }

  submitWizardStep2(): void {
    this.formError = '';
    if (this.parentId) {
      this.submitWizardAddHotelUnderOrg();
      return;
    }
    this.submitFullOrganizationWizard();
  }

  /** Add hotel under existing org (list action). Single POST to tenant create. */
  private submitWizardAddHotelUnderOrg(): void {
    const orgId = this.createdOrgId;
    if (!orgId) {
      this.formError = 'SUPER_ADMIN.CREATE_VALIDATION';
      return;
    }
    if (this.isWizardHotelLicenseDateRangeInvalid) {
      this.formError = 'SUPER_ADMIN.CREATE_LICENSE_DATE_RANGE_INVALID';
      return;
    }
    if (!this.hotelMaxUsers || this.hotelMaxUsers < 1) {
      this.formError = 'SUPER_ADMIN.CREATE_VALIDATION';
      return;
    }
    if (!this.hotelName?.trim() || !this.hotelSlug?.trim()) {
      this.formError = 'SUPER_ADMIN.CREATE_VALIDATION';
      return;
    }

    let hotelAdminUser: TenantCreateAdminUserPayload | undefined;
    if (this.hotelAdminMode === 'new') {
      if (
        !this.hotelAdminFirstName?.trim() ||
        !this.hotelAdminLastName?.trim() ||
        !this.hotelAdminEmail?.trim() ||
        !this.hotelAdminPassword ||
        this.hotelAdminPassword.length < 8
      ) {
        this.formError =
          !this.hotelAdminPassword || this.hotelAdminPassword.length < 8
            ? 'SUPER_ADMIN.CREATE_PASSWORD_MIN'
            : 'SUPER_ADMIN.CREATE_VALIDATION';
        return;
      }
      hotelAdminUser = {
        email: this.hotelAdminEmail.trim(),
        firstName: this.hotelAdminFirstName.trim(),
        lastName: this.hotelAdminLastName.trim(),
        password: this.hotelAdminPassword,
      };
    }

    const childPayload = this.buildWizardChildHotelPayload(orgId, hotelAdminUser);
    this.saving.set(true);
    this.api
      .create(childPayload)
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: () => {
          this.message.success(this.translate.instant('SUPER_ADMIN.CREATE_SUCCESS'));
          this.saved.emit();
        },
        error: (err) => {
          this.formError = formErrorKeyFromHttp(err, 'SUPER_ADMIN.CREATE_FAILED');
          this.message.error(this.getErrorMessage());
        },
      });
  }

  /** New org + first hotel: one POST /full-organization. */
  private submitFullOrganizationWizard(): void {
    if (!this.name?.trim() || !this.slug?.trim()) {
      this.formError = 'SUPER_ADMIN.CREATE_VALIDATION';
      return;
    }
    if (!this.adminFirstName?.trim() || !this.adminLastName?.trim() || !this.adminEmail?.trim()) {
      this.formError = 'SUPER_ADMIN.CREATE_VALIDATION';
      return;
    }
    if (!this.adminPhone?.trim()) {
      this.formError = 'SUPER_ADMIN.CREATE_VALIDATION';
      return;
    }
    if (!this.adminPassword || this.adminPassword.length < 8) {
      this.formError = 'SUPER_ADMIN.CREATE_PASSWORD_MIN';
      return;
    }
    if (this.isWizardHotelLicenseDateRangeInvalid) {
      this.formError = 'SUPER_ADMIN.CREATE_LICENSE_DATE_RANGE_INVALID';
      return;
    }
    if (!this.hotelMaxUsers || this.hotelMaxUsers < 1) {
      this.formError = 'SUPER_ADMIN.CREATE_VALIDATION';
      return;
    }
    if (!this.hotelName?.trim() || !this.hotelSlug?.trim()) {
      this.formError = 'SUPER_ADMIN.CREATE_VALIDATION';
      return;
    }

    if (this.hotelAdminMode === 'new') {
      if (
        !this.hotelAdminFirstName?.trim() ||
        !this.hotelAdminLastName?.trim() ||
        !this.hotelAdminEmail?.trim() ||
        !this.hotelAdminPassword ||
        this.hotelAdminPassword.length < 8
      ) {
        this.formError =
          !this.hotelAdminPassword || this.hotelAdminPassword.length < 8
            ? 'SUPER_ADMIN.CREATE_PASSWORD_MIN'
            : 'SUPER_ADMIN.CREATE_VALIDATION';
        return;
      }
    }

    const payload = this.buildFullOrganizationPayload();
    this.saving.set(true);
    this.api
      .createFullOrganization(payload)
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: () => {
          this.message.success(this.translate.instant('SUPER_ADMIN.FULL_ORG_CREATE_SUCCESS'));
          this.saved.emit();
        },
        error: (err) => {
          this.formError = formErrorKeyFromHttp(err, 'SUPER_ADMIN.CREATE_FAILED');
          this.message.error(this.getErrorMessage());
        },
      });
  }

  private buildFullOrganizationPayload(): CreateFullOrganizationPayload {
    const maxBr = Math.max(1, Math.floor(this.maxBranches || 1));
    const slugHotel = this.hotelSlug.trim().toLowerCase().replace(/\s+/g, '-');

    const hotel: CreateFullOrganizationPayload['hotel'] = {
      name: this.hotelName.trim(),
      slug: slugHotel,
      planType: this.hotelPlanType,
      subStatus: this.hotelSubStatus,
      licenseStartDate: this.toApiDate(this.hotelLicenseStartDate),
      licenseEndDate: this.toApiDate(this.hotelLicenseEndDate) ?? null,
      maxUsers: this.hotelMaxUsers,
    };

    if (this.hotelAdminMode === 'new') {
      hotel.adminUser = {
        email: this.hotelAdminEmail.trim(),
        firstName: this.hotelAdminFirstName.trim(),
        lastName: this.hotelAdminLastName.trim(),
        password: this.hotelAdminPassword,
      };
    }

    return {
      organization: {
        name: this.name.trim(),
        slug: this.slug.trim().toLowerCase().replace(/\s+/g, '-'),
        maxBranches: maxBr,
      },
      adminUser: {
        firstName: this.adminFirstName?.trim() || 'Admin',
        lastName: this.adminLastName?.trim() || this.name.trim(),
        email: this.adminEmail.trim(),
        password: this.adminPassword,
        phone: this.adminPhone.trim(),
      },
      hotel,
    };
  }

  private applyWizardHotelLicenseFromOrgRow(row: TenantRow): void {
    const pt = (row.planType as PlanType) ?? 'BASIC';
    this.hotelPlanType = pt;
    this.hotelSubStatus = row.subStatus ?? 'TRIAL';
    const limit = PLAN_LIMITS[pt];
    this.hotelMaxUsers = row.maxUsers ?? (limit != null ? limit : 5);
    this.hotelLicenseStartDate = row.licenseStartDate ? new Date(row.licenseStartDate) : new Date();
    this.hotelLicenseEndDate = row.licenseEndDate ? new Date(row.licenseEndDate) : null;
  }

  private buildWizardChildHotelPayload(
    parentId: string,
    adminUser?: TenantCreateAdminUserPayload,
  ): TenantCreatePayload {
    const payload: TenantCreatePayload = {
      name: this.hotelName.trim(),
      slug: this.hotelSlug.trim().toLowerCase().replace(/\s+/g, '-'),
      planType: this.hotelPlanType,
      subStatus: this.hotelSubStatus,
      maxUsers: this.hotelMaxUsers,
      licenseStartDate: this.toApiDate(this.hotelLicenseStartDate),
      licenseEndDate: this.toApiDate(this.hotelLicenseEndDate) ?? null,
      parentId,
      assignOrgManagersToBranch: true,
    };
    if (adminUser) {
      payload.adminUser = adminUser;
    }
    return payload;
  }

  private submitEdit(): void {
    if (!this.editId || !this.name?.trim()) {
      this.formError = 'SUPER_ADMIN.CREATE_VALIDATION';
      return;
    }
    const payload: TenantUpdatePayload = {
      name: this.name.trim(),
      planType: this.planType,
      subStatus: this.subStatus,
      maxUsers: this.maxUsers,
      licenseStartDate: this.toApiDate(this.licenseStartDate),
      licenseEndDate: this.toApiDate(this.licenseEndDate) ?? null,
      parentId: this.parentId || null,
      hasBranches: !!this.hasBranches,
      maxBranches: this.maxBranches || 0,
    };
    this.saving.set(true);
    this.api.updateTenant(this.editId, payload).subscribe({
      next: () => {
        this.saving.set(false);
        this.message.success(this.translate.instant('SUPER_ADMIN.UPDATE_SUCCESS'));
        this.saved.emit();
      },
      error: (err) => {
        this.formError = formErrorKeyFromHttp(err, 'SUPER_ADMIN.UPDATE_FAILED');
        this.message.error(this.getErrorMessage());
        this.saving.set(false);
      },
    });
  }

  private submitCreate(): void {
    if (!this.name?.trim() || !this.slug?.trim() || !this.adminEmail?.trim()) {
      this.formError = 'SUPER_ADMIN.CREATE_VALIDATION';
      return;
    }
    if (!this.adminFirstName?.trim() || !this.adminLastName?.trim()) {
      this.formError = 'SUPER_ADMIN.CREATE_VALIDATION';
      return;
    }
    if (!this.importingExistingAdmin()) {
      if (!this.adminPassword || this.adminPassword.length < 8) {
        this.formError = 'SUPER_ADMIN.CREATE_PASSWORD_MIN';
        return;
      }
    }
    const payload: TenantCreatePayload = {
      name: this.name.trim(),
      slug: this.slug.trim().toLowerCase().replace(/\s+/g, '-'),
      planType: this.planType,
      subStatus: this.subStatus as 'TRIAL' | 'ACTIVE',
      maxUsers: this.maxUsers,
      licenseStartDate: this.toApiDate(this.licenseStartDate),
      licenseEndDate: this.toApiDate(this.licenseEndDate) ?? null,
      parentId: this.parentId || null,
      adminEmail: this.adminEmail.trim(),
      adminFirstName: this.adminFirstName?.trim() || 'Admin',
      adminLastName: this.adminLastName?.trim() || this.name.trim(),
    };
    // Keep maxBranches org-only and >= 1; do not send hasBranches at all.
    if (!this.parentId) {
      payload.maxBranches = Math.max(1, Math.floor(this.maxBranches || 1));
    }
    if (this.importingExistingAdmin() && this.emailPick?.source === 'existing') {
      payload.existingUserId = this.emailPick.user.id;
    } else {
      payload.adminPassword = this.adminPassword;
    }
    if (this.parentId) {
      payload.assignOrgManagersToBranch = this.assignOrgManagersToBranch;
    }
    this.saving.set(true);
    this.api.create(payload).subscribe({
      next: () => {
        this.saving.set(false);
        this.message.success(this.translate.instant('SUPER_ADMIN.CREATE_SUCCESS'));
        this.saved.emit();
      },
      error: (err) => {
        this.formError = formErrorKeyFromHttp(err, 'SUPER_ADMIN.CREATE_FAILED');
        this.message.error(this.getErrorMessage());
        this.saving.set(false);
      },
    });
  }

  private startOfDay(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  private toApiDate(date: Date | null): string | undefined {
    if (!date) {
      return undefined;
    }
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
