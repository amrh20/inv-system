import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { forkJoin } from 'rxjs';
import { first } from 'rxjs/operators';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { TranslatePipe } from '@ngx-translate/core';
import { LucideAngularModule } from 'lucide-angular';
import { Building2, Check, Save, X } from 'lucide-angular';
import { CategoriesService } from '../../services/categories.service';
import { LocationsService } from '../../services/locations.service';
import type { CategoryRow } from '../../models/category.model';
import type { LocationRow } from '../../models/location.model';

interface GroupedCategories {
  departmentName: string;
  categories: CategoryRow[];
}

@Component({
  selector: 'app-location-categories-modal',
  standalone: true,
  imports: [
    NzButtonModule,
    NzModalModule,
    NzSpinModule,
    TranslatePipe,
    LucideAngularModule,
  ],
  template: `
    <nz-modal
      [nzVisible]="!!location()"
      [nzTitle]="'LOCATIONS.MANAGE_CATEGORIES' | translate"
      (nzOnCancel)="close()"
      nzWidth="420"
      [nzFooter]="null"
      [nzClosable]="true"
      nzMaskClosable="false"
    >
      @if (location()) {
        <div class="location-cat-modal">
          <p class="location-cat-modal__subtitle">
            {{ location()!.name }} — {{ selectedIds().size }} {{ 'COMMON.SELECTED' | translate }}
          </p>
          @if (error()) {
            <div class="location-cat-modal__error">{{ error() }}</div>
          }
          @if (loading()) {
            <div class="location-cat-modal__spinner">
              <nz-spin nzSimple />
            </div>
          } @else {
            <div class="location-cat-modal__list">
              @for (group of groupedCategories(); track group.departmentName) {
                <div class="location-cat-modal__group">
                  <div class="location-cat-modal__group-title">
                    <lucide-icon [img]="lucideBuilding" [size]="12" />
                    <span>{{ group.departmentName }}</span>
                  </div>
                  <div class="location-cat-modal__items">
                    @for (cat of group.categories; track cat.id) {
                      <label
                        class="location-cat-modal__item"
                        (click)="toggle(cat.id)"
                      >
                        <div
                          class="location-cat-modal__check"
                          [class.location-cat-modal__check--active]="selectedIds().has(cat.id)"
                        >
                          @if (selectedIds().has(cat.id)) {
                            <lucide-icon [img]="lucideCheck" [size]="12" />
                          }
                        </div>
                        <span class="location-cat-modal__label">{{ cat.name }}</span>
                      </label>
                    }
                  </div>
                </div>
              }
            </div>
          }
          <div class="location-cat-modal__footer">
            <button nz-button nzType="default" (click)="close()">
              <lucide-icon [img]="lucideX" [size]="14" />
              {{ 'COMMON.CANCEL' | translate }}
            </button>
            <button
              nz-button
              nzType="primary"
              [disabled]="saving() || loading()"
              (click)="save()"
            >
              @if (saving()) {
                <nz-spin nzSimple [nzSize]="'small'" />
              } @else {
                <lucide-icon [img]="lucideSave" [size]="14" />
              }
              {{ 'COMMON.SAVE' | translate }}
            </button>
          </div>
        </div>
      }
    </nz-modal>
  `,
  styles: [
    `
      .location-cat-modal {
        display: flex;
        flex-direction: column;
        min-height: 200px;
      }
      .location-cat-modal__subtitle {
        margin: 0 0 12px;
        font-size: 12px;
        color: rgba(0, 0, 0, 0.45);
      }
      .location-cat-modal__error {
        padding: 8px 12px;
        font-size: 12px;
        color: var(--color-brand-error);
        background: rgba(255, 77, 79, 0.08);
        border-radius: var(--radius-brand);
        margin-bottom: 12px;
      }
      .location-cat-modal__spinner {
        display: flex;
        justify-content: center;
        padding: 32px;
      }
      .location-cat-modal__list {
        flex: 1;
        max-height: 360px;
        overflow-y: auto;
        margin-bottom: 16px;
      }
      .location-cat-modal__group {
        margin-bottom: 16px;
      }
      .location-cat-modal__group:last-child {
        margin-bottom: 0;
      }
      .location-cat-modal__group-title {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 11px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: rgba(0, 0, 0, 0.5);
        margin-bottom: 8px;
      }
      .location-cat-modal__group-title lucide-icon {
        flex-shrink: 0;
      }
      .location-cat-modal__items {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }
      .location-cat-modal__item {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 8px 12px;
        border-radius: 6px;
        cursor: pointer;
        transition: background 0.15s;
      }
      .location-cat-modal__item:hover {
        background: rgba(0, 0, 0, 0.04);
      }
      .location-cat-modal__check {
        width: 20px;
        height: 20px;
        border: 1.5px solid #d9d9d9;
        border-radius: 4px;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        transition: all 0.15s;
      }
      .location-cat-modal__check--active {
        background: var(--primary-color);
        border-color: var(--primary-color);
        color: #fff;
      }
      .location-cat-modal__label {
        font-size: 13px;
        color: rgba(0, 0, 0, 0.75);
      }
      .location-cat-modal__footer {
        display: flex;
        justify-content: flex-end;
        gap: 8px;
        padding-top: 12px;
        border-top: 1px solid var(--border-color-split);
      }
      .location-cat-modal__footer button {
        display: inline-flex;
        align-items: center;
        gap: 6px;
      }
    `,
  ],
})
export class LocationCategoriesModalComponent {
  private readonly categoriesApi = inject(CategoriesService);
  private readonly locationsApi = inject(LocationsService);

  readonly location = input<LocationRow | null>(null);
  readonly closed = output<void>();
  readonly saved = output<void>();

  readonly lucideBuilding = Building2;
  readonly lucideCheck = Check;
  readonly lucideSave = Save;
  readonly lucideX = X;

  readonly allCategories = signal<CategoryRow[]>([]);
  readonly selectedIds = signal<Set<string>>(new Set());
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly error = signal('');

  readonly groupedCategories = computed<GroupedCategories[]>(() => {
    const cats = this.allCategories();
    const byDept = new Map<string, CategoryRow[]>();
    for (const c of cats) {
      const key = c.department?.name ?? 'General';
      if (!byDept.has(key)) byDept.set(key, []);
      byDept.get(key)!.push(c);
    }
    return Array.from(byDept.entries()).map(([departmentName, categories]) => ({
      departmentName,
      categories,
    }));
  });

  constructor() {
    effect(() => {
      const loc = this.location();
      if (loc?.id) {
        this.error.set('');
        this.load(loc);
      }
    });
  }

  private load(loc: LocationRow): void {
    this.loading.set(true);
    forkJoin({
      all: this.categoriesApi.list({ isActive: true, take: 200 }),
      linked: this.locationsApi.getCategories(loc.id),
    })
      .pipe(first())
      .subscribe({
        next: ({ all, linked }) => {
          const cats = all.categories ?? [];
          this.allCategories.set(cats);
          const ids = new Set((linked ?? []).map((c) => c.id));
          this.selectedIds.set(ids);
          this.loading.set(false);
        },
        error: () => {
          this.error.set('Failed to load categories');
          this.loading.set(false);
        },
      });
  }

  toggle(id: string): void {
    this.selectedIds.update((set) => {
      const next = new Set(set);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  save(): void {
    const loc = this.location();
    if (!loc) return;
    this.saving.set(true);
    this.error.set('');
    this.locationsApi
      .setCategories(loc.id, Array.from(this.selectedIds()))
      .pipe(first())
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.saved.emit();
          this.close();
        },
        error: (err: { error?: { message?: string } }) => {
          this.saving.set(false);
          this.error.set(err?.error?.message ?? 'Failed to save');
        },
      });
  }

  close(): void {
    this.closed.emit();
  }
}
