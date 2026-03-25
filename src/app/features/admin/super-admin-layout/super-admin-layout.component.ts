import { Component, inject } from '@angular/core';
import { UpperCasePipe } from '@angular/common';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { LucideAngularModule } from 'lucide-angular';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDropDownModule } from 'ng-zorro-antd/dropdown';
import { NzMenuModule } from 'ng-zorro-antd/menu';
import {
  Building2,
  ChevronDown,
  ChevronRight,
  LayoutDashboard,
  LogOut,
  ScrollText,
  Shield,
} from 'lucide-angular';
import { AuthService } from '../../../core/services/auth.service';

const NAV_ITEMS = [
  {
    path: '/admin/tenants',
    icon: Building2,
    labelKey: 'SUPER_ADMIN.HOTEL_MANAGEMENT',
    descKey: 'SUPER_ADMIN.HOTEL_MANAGEMENT_DESC',
  },
  {
    path: '/admin/logs',
    icon: ScrollText,
    labelKey: 'SUPER_ADMIN.AUDIT_LOG',
    descKey: 'SUPER_ADMIN.AUDIT_LOG_DESC',
  },
];

@Component({
  selector: 'app-super-admin-layout',
  standalone: true,
  imports: [
    UpperCasePipe,
    RouterLink,
    RouterLinkActive,
    RouterOutlet,
    TranslatePipe,
    LucideAngularModule,
    NzButtonModule,
    NzDropDownModule,
    NzMenuModule,
  ],
  templateUrl: './super-admin-layout.component.html',
  styleUrl: './super-admin-layout.component.scss',
})
export class SuperAdminLayoutComponent {
  private readonly auth = inject(AuthService);

  readonly navItems = NAV_ITEMS;
  readonly lucideShield = Shield;
  readonly lucideLogOut = LogOut;
  readonly lucideLayoutDashboard = LayoutDashboard;
  readonly lucideChevronRight = ChevronRight;
  readonly lucideChevronDown = ChevronDown;
  readonly currentUser = this.auth.currentUser;

  displayName(): string {
    const user = this.currentUser();
    if (!user) return 'User';
    return `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || user.email;
  }

  logout(): void {
    this.auth.logout();
  }
}
