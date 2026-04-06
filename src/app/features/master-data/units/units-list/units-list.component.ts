import { NgClass } from '@angular/common';
import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { map } from 'rxjs/operators';
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
import { BaseMasterDataController } from '../../shared/base-master-data.controller';
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

  private readonly controller = new BaseMasterDataController<UnitRow>(
    this.destroyRef,
    (params) =>
      this.api.list({
        search: params.search,
        skip: params.skip,
        take: params.take,
      }).pipe(map((res) => ({ items: res.units, total: res.total }))),
    () => this.t('UNITS.ERROR_LOAD'),
    25,
  );
  readonly units = this.controller.rows;
  readonly total = this.controller.total;
  readonly loading = this.controller.loading;
  readonly listError = this.controller.listError;
  readonly searchDraft = this.controller.searchDraft;
  readonly pageIndex = this.controller.pageIndex;
  readonly pageSize = this.controller.pageSize;

  readonly formOpen = signal(false);
  readonly formUnit = signal<UnitRow | null>(null);

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
    this.controller.onPageIndexChange(i);
  }

  onPageSizeChange(n: number): void {
    this.controller.onPageSizeChange(n);
  }

  private t(key: string, params?: Record<string, unknown>): string {
    return this.translate.instant(key, params);
  }
}
