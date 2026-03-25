import { Injectable, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { tap, catchError, of } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { User, ApiResponse, AuthResponse, LoginApiEnvelope, LoginCredentials } from '../models';

const AUTH_STORAGE_KEY = 'ose-auth';

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  currentTenant: CurrentTenant | null;
  isAuthenticated: boolean;
}

export interface CurrentTenant {
  id: string | null;
  slug: string | null;
  name: string | null;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly apiUrl = environment.apiUrl;

  private readonly _currentUser = signal<User | null>(null);
  private readonly _accessToken = signal<string | null>(null);
  private readonly _refreshToken = signal<string | null>(null);
  private readonly _currentTenant = signal<CurrentTenant | null>(null);
  private readonly _isAuthenticated = signal(false);

  readonly currentUser = this._currentUser.asReadonly();
  readonly currentTenant = this._currentTenant.asReadonly();
  readonly isAuthenticated = this._isAuthenticated.asReadonly();

  constructor() {
    this.hydrateFromStorage();
  }

  login(credentials: LoginCredentials) {
    const body: Record<string, string> = {
      email: credentials.email,
      password: credentials.password,
    };
    if (credentials.tenantSlug) {
      body['tenantSlug'] = credentials.tenantSlug;
    }
    if (credentials.selectedTenantId) {
      body['tenantId'] = credentials.selectedTenantId;
    }
    if (credentials.selectedRole) {
      body['selectedRole'] = credentials.selectedRole;
    }
    return this.http
      .post<LoginApiEnvelope>(`${this.apiUrl}/auth/login`, body)
      .pipe(
        tap((res) => {
          const rawUser = res.data?.user;
          const accessToken = res.data?.accessToken;
          const refreshToken = res.data?.refreshToken;
          if (res.success && rawUser && accessToken && refreshToken) {
            const user = {
              ...rawUser,
              tenantId: rawUser.tenantId ?? credentials.selectedTenantId ?? null,
              role: rawUser.role ?? credentials.selectedRole,
              memberships: rawUser.memberships ?? credentials.memberships ?? [],
            };
            this.setAuth({
              user,
              accessToken,
              refreshToken,
              currentTenant: this.resolveCurrentTenant(user, credentials.tenantSlug),
            });
          }
        })
      );
  }

  switchTenant(tenantSlug: string) {
    const body = { tenantSlug };
    return this.http
      .post<ApiResponse<AuthResponse>>(`${this.apiUrl}/auth/switch-tenant`, body)
      .pipe(
        tap((res) => {
          const rawUser = res.data?.user;
          const accessToken = res.data?.accessToken;
          const refreshToken = res.data?.refreshToken;
          if (res.success && rawUser && accessToken && refreshToken) {
            const previousMemberships = this._currentUser()?.memberships ?? [];
            const user = {
              ...rawUser,
              memberships:
                rawUser.memberships && rawUser.memberships.length
                  ? rawUser.memberships
                  : previousMemberships,
            };
            this.setAuth({
              user,
              accessToken,
              refreshToken,
              currentTenant: this.resolveCurrentTenant(user, tenantSlug),
            });
          }
        })
      );
  }

  logout() {
    const refreshToken = this._refreshToken();
    if (refreshToken) {
      this.http
        .post<ApiResponse<unknown>>(`${this.apiUrl}/auth/logout`, { refreshToken })
        .pipe(catchError(() => of(null)))
        .subscribe();
    }
    this.clearAuth();
    this.router.navigate(['/login']);
  }

  refreshToken() {
    const refreshToken = this._refreshToken();
    if (!refreshToken) {
      return of(null);
    }
    return this.http
      .post<ApiResponse<{ accessToken: string }>>(`${this.apiUrl}/auth/refresh`, {
        refreshToken,
      })
      .pipe(
        tap((res) => {
          if (res.success && res.data?.accessToken) {
            this._accessToken.set(res.data.accessToken);
            this.persistToStorage();
          }
        }),
        catchError(() => {
          this.clearAuth();
          this.router.navigate(['/login']);
          return of(null);
        })
      );
  }

  getMe() {
    return this.http.get<ApiResponse<User>>(`${this.apiUrl}/auth/me`).pipe(
      tap((res) => {
        if (res.success && res.data) {
          this._currentUser.set(res.data);
          this._currentTenant.set(this.resolveCurrentTenant(res.data));
          this.persistToStorage();
        }
      })
    );
  }

  getAccessToken(): string | null {
    return this._accessToken();
  }

  setAccessToken(token: string) {
    this._accessToken.set(token);
    this.persistToStorage();
  }

  setAuth(payload: {
    user: User;
    accessToken: string;
    refreshToken: string;
    currentTenant?: CurrentTenant | null;
  }) {
    this._currentUser.set(payload.user);
    this._accessToken.set(payload.accessToken);
    this._refreshToken.set(payload.refreshToken);
    this._currentTenant.set(payload.currentTenant ?? this.resolveCurrentTenant(payload.user));
    this._isAuthenticated.set(true);
    this.persistToStorage();
  }

  clearAuth() {
    this._currentUser.set(null);
    this._accessToken.set(null);
    this._refreshToken.set(null);
    this._currentTenant.set(null);
    this._isAuthenticated.set(false);
    localStorage.removeItem(AUTH_STORAGE_KEY);
  }

  hasRole(...roles: string[]): boolean {
    const user = this._currentUser();
    return user ? roles.includes(user.role) : false;
  }

  /**
   * Parent-organization mode is enabled only when:
   * - Current tenant is a root organization (parentId === null), and
   * - User has at least one child hotel membership under that organization.
   *
   * This intentionally keeps standalone root tenants unrestricted.
   */
  isParentOrganizationContext(): boolean {
    const currentTenant = this._currentTenant();
    const memberships = this._currentUser()?.memberships ?? [];
    if (!currentTenant?.id || memberships.length === 0) {
      return false;
    }

    const currentMembership =
      memberships.find((item) => item.tenantId === currentTenant.id) ??
      memberships.find((item) => currentTenant.slug && item.tenantSlug === currentTenant.slug);

    if (!currentMembership || !currentMembership.tenantId) {
      return false;
    }

    if (currentMembership.parentId !== null) {
      return false;
    }

    return memberships.some(
      (item) => !!item.tenantId && item.parentId === currentMembership.tenantId,
    );
  }

  private hydrateFromStorage() {
    try {
      const raw = localStorage.getItem(AUTH_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { state?: AuthState };
      const state = parsed?.state;
      if (state?.isAuthenticated && state.user && state.accessToken && state.refreshToken) {
        this._currentUser.set(state.user);
        this._accessToken.set(state.accessToken);
        this._refreshToken.set(state.refreshToken);
        this._currentTenant.set(state.currentTenant ?? this.resolveCurrentTenant(state.user));
        this._isAuthenticated.set(true);
      }
    } catch {
      localStorage.removeItem(AUTH_STORAGE_KEY);
    }
  }

  private persistToStorage() {
    const state: AuthState = {
      user: this._currentUser(),
      accessToken: this._accessToken(),
      refreshToken: this._refreshToken(),
      currentTenant: this._currentTenant(),
      isAuthenticated: this._isAuthenticated(),
    };
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ state }));
  }

  private resolveCurrentTenant(user: User | null, selectedTenantSlug?: string): CurrentTenant | null {
    if (!user) {
      return null;
    }

    const memberships = user.memberships ?? [];
    const slug = selectedTenantSlug || user.tenant?.slug || null;
    const membership =
      memberships.find((item) => (slug ? item.tenantSlug === slug : false)) ??
      memberships.find((item) => (user.tenantId ? item.tenantId === user.tenantId : false));

    const tenantId = user.tenantId ?? membership?.tenantId ?? null;
    const tenantSlug = slug ?? membership?.tenantSlug ?? null;
    const tenantName = user.tenant?.name ?? membership?.tenantName ?? null;

    if (!tenantId && !tenantSlug && !tenantName) {
      return null;
    }

    return {
      id: tenantId,
      slug: tenantSlug,
      name: tenantName,
    };
  }
}
