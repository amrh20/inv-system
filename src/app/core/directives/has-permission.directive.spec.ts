import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AuthService } from '../services/auth.service';
import { HasPermissionDirective } from './has-permission.directive';

class MockAuthService {
  readonly permissions = signal<string[]>([]);

  hasPermission(key: string): boolean {
    return this.permissions().includes(key);
  }
}

@Component({
  standalone: true,
  imports: [HasPermissionDirective],
  template: `<button id="guarded" *appHasPermission="'TEST_PERMISSION'">Allowed</button>`,
})
class HostComponent {}

describe('HasPermissionDirective', () => {
  let auth: MockAuthService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [{ provide: AuthService, useClass: MockAuthService }],
    }).compileComponents();

    auth = TestBed.inject(AuthService) as unknown as MockAuthService;
  });

  it('reacts to permission signal updates', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('#guarded')).toBeNull();

    auth.permissions.set(['TEST_PERMISSION']);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('#guarded')).not.toBeNull();

    auth.permissions.set([]);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('#guarded')).toBeNull();
  });
});
