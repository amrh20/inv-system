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
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTooltipModule } from 'ng-zorro-antd/tooltip';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { LucideAngularModule } from 'lucide-angular';
import {
  Building2,
  EllipsisVertical,
  Filter,
  MapPin,
  Package,
  Pencil,
  Plus,
  Search,
  Tag,
  Trash2,
  Users,
} from 'lucide-angular';
import { ConfirmationService } from '../../../../core/services/confirmation.service';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { ItemMasterLookupsService } from '../../../items/services/item-master-lookups.service';
import { LocationCategoriesModalComponent } from '../location-categories-modal/location-categories-modal.component';
import { LocationFormComponent } from '../location-form/location-form.component';
import type { LocationRow } from '../../models/location.model';
import { LocationsService } from '../../services/locations.service';

interface GroupedLocations {
  departmentName: string;
  locations: LocationRow[];
}

@Component({
  selector: 'app-locations-list',
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
    NzSelectModule,
    NzSpinModule,
    NzTooltipModule,
    TranslatePipe,
    LucideAngularModule,
    EmptyStateComponent,
    LocationCategoriesModalComponent,
    LocationFormComponent,
  ],
  templateUrl: './locations-list.component.html',
  styleUrl: './locations-list.component.scss',
})
export class LocationsListComponent implements OnInit {
  private readonly api = inject(LocationsService);
  private readonly confirmation = inject(ConfirmationService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly lookups = inject(ItemMasterLookupsService);
  private readonly translate = inject(TranslateService);

  readonly lucideMapPin = MapPin;
  readonly lucidePlus = Plus;
  readonly lucideSearch = Search;
  readonly lucideFilter = Filter;
  readonly lucideBuilding = Building2;
  readonly lucidePencil = Pencil;
  readonly lucideTrash = Trash2;
  readonly lucideEllipsisVertical = EllipsisVertical;
  readonly lucideTag = Tag;
  readonly lucidePackage = Package;
  readonly lucideUsers = Users;

  readonly locations = signal<LocationRow[]>([]);
  readonly loading = signal(false);
  readonly listError = signal('');
  readonly departments = signal<{ id: string; name: string }[]>([]);

  readonly searchDraft = signal('');
  private readonly searchTerm = signal('');
  private readonly search$ = new Subject<string>();
  readonly departmentId = signal<string | null>(null);

  readonly formOpen = signal(false);
  readonly formLocation = signal<LocationRow | null>(null);
  readonly categoriesModalLocation = signal<LocationRow | null>(null);

  readonly groupedLocations = computed<GroupedLocations[]>(() => {
    const locs = this.locations();
    const byDept = new Map<string, LocationRow[]>();
    for (const loc of locs) {
      const key = loc.department?.name ?? 'Unassigned';
      if (!byDept.has(key)) byDept.set(key, []);
      byDept.get(key)!.push(loc);
    }
    const entries = Array.from(byDept.entries()).sort(([a], [b]) =>
      a === 'Unassigned' ? 1 : b === 'Unassigned' ? -1 : a.localeCompare(b),
    );
    return entries.map(([departmentName, locations]) => ({ departmentName, locations }));
  });

  ngOnInit(): void {
    this.search$
      .pipe(debounceTime(300), takeUntilDestroyed(this.destroyRef))
      .subscribe((q) => {
        this.searchTerm.set(q);
        this.load();
      });
    this.loadDepartments();
    this.load();
  }

  private loadDepartments(): void {
    this.lookups
      .listDepartments({ take: 200, isActive: true })
      .pipe(first())
      .subscribe({ next: (d) => this.departments.set(d), error: () => this.departments.set([]) });
  }

  onSearchChange(value: string): void {
    this.searchDraft.set(value);
    this.search$.next(value.trim());
  }

  onDepartmentChange(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.listError.set('');
    this.api
      .list({
        search: this.searchTerm() || undefined,
        departmentId: this.departmentId() ?? undefined,
        skip: 0,
        take: 500,
      })
      .pipe(first())
      .subscribe({
        next: (res) => {
          this.locations.set(res.locations);
          this.loading.set(false);
        },
        error: (err: { error?: { message?: string } }) => {
          this.loading.set(false);
          this.listError.set(err?.error?.message ?? this.t('LOCATIONS.ERROR_LOAD'));
        },
      });
  }

  openCreate(): void {
    this.formLocation.set(null);
    this.formOpen.set(true);
  }

  openEdit(row: LocationRow): void {
    this.formLocation.set(row);
    this.formOpen.set(true);
  }

  closeForm(): void {
    this.formOpen.set(false);
    this.formLocation.set(null);
  }

  onFormSaved(): void {
    this.closeForm();
    this.load();
  }

  openCategoriesModal(loc: LocationRow): void {
    this.categoriesModalLocation.set(loc);
  }

  closeCategoriesModal(): void {
    this.categoriesModalLocation.set(null);
  }

  onCategoriesSaved(): void {
    this.closeCategoriesModal();
    this.load();
  }

  getTypeLabel(type: string): string {
    const key = 'LOCATIONS.TYPE_' + type;
    return this.translate.instant(key);
  }

  onDeleteClick(row: LocationRow): void {
    this.confirmation
      .confirm({
        title: this.t('LOCATIONS.CONFIRM_DELETE_TITLE'),
        message: this.t('LOCATIONS.CONFIRM_DELETE_MESSAGE', { name: row.name }),
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

  private t(key: string, params?: Record<string, unknown>): string {
    return this.translate.instant(key, params);
  }
}
