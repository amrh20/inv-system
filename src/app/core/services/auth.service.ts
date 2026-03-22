import { Injectable, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { tap, catchError, of } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { User, ApiResponse, AuthResponse, LoginCredentials } from '../models';

const AUTH_STORAGE_KEY = 'ose-auth';

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly apiUrl = environment.apiUrl;

  private readonly _currentUser = signal<User | null>(null);
  private readonly _accessToken = signal<string | null>(null);
  private readonly _refreshToken = signal<string | null>(null);
  private readonly _isAuthenticated = signal(false);

  readonly currentUser = this._currentUser.asReadonly();
  readonly isAuthenticated = this._isAuthenticated.asReadonly();

  constructor() {
    this.hydrateFromStorage();
  }

  login(credentials: LoginCredentials) {
    const body = {
      email: credentials.email,
      password: credentials.password,
      tenantSlug: credentials.tenantSlug ?? '',
    };
    return this.http
      .post<ApiResponse<AuthResponse>>(`${this.apiUrl}/auth/login`, body)
      .pipe(
        tap((res) => {
          if (res.success && res.data) {
            this.setAuth({
              user: res.data.user,
              accessToken: res.data.accessToken,
              refreshToken: res.data.refreshToken,
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

  setAuth(payload: { user: User; accessToken: string; refreshToken: string }) {
    this._currentUser.set(payload.user);
    this._accessToken.set(payload.accessToken);
    this._refreshToken.set(payload.refreshToken);
    this._isAuthenticated.set(true);
    this.persistToStorage();
  }

  clearAuth() {
    this._currentUser.set(null);
    this._accessToken.set(null);
    this._refreshToken.set(null);
    this._isAuthenticated.set(false);
    localStorage.removeItem(AUTH_STORAGE_KEY);
  }

  hasRole(...roles: string[]): boolean {
    const user = this._currentUser();
    return user ? roles.includes(user.role) : false;
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
      isAuthenticated: this._isAuthenticated(),
    };
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ state }));
  }
}
