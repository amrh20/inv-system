import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject, Injector } from '@angular/core';
import { NzModalService } from 'ng-zorro-antd/modal';
import { Router } from '@angular/router';
import { catchError, switchMap, throwError } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';
import { AuthService } from '../services/auth.service';

const isAuthEndpoint = (url: string) =>
  url.includes('/auth/login') || url.includes('/auth/refresh');

/** Translation JSON must not go through auth refresh / headers (avoids broken i18n). */
const isTranslationJsonRequest = (url: string): boolean => {
  try {
    const path = url.includes('://') ? new URL(url).pathname : url;
    return path.includes('/i18n/') && path.endsWith('.json');
  } catch {
    return url.includes('/i18n/') && url.endsWith('.json');
  }
};

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  if (isTranslationJsonRequest(req.url)) {
    return next(req);
  }

  const injector = inject(Injector);
  const authService = injector.get(AuthService);
  const router = inject(Router);
  const translate = injector.get(TranslateService);
  const token = authService.getAccessToken();

  const cloned = token
    ? req.clone({
        setHeaders: { Authorization: `Bearer ${token}` },
      })
    : req;

  return next(cloned).pipe(
    catchError((error: HttpErrorResponse) => {
      const errorCode = error.error?.error ?? error.error?.code;

      if (error.status === 403) {
        if (errorCode === 'ORGANIZATION_SUSPENDED' || errorCode === 'ACCOUNT_SUSPENDED') {
          const modal = injector.get(NzModalService);
          modal.error({
            nzTitle: translate.instant('AUTH.SUSPENSION.TITLE'),
            nzContent:
              errorCode === 'ORGANIZATION_SUSPENDED'
                ? translate.instant('AUTH.SUSPENSION.ORGANIZATION_MESSAGE')
                : translate.instant('AUTH.SUSPENSION.ACCOUNT_MESSAGE'),
            nzMaskClosable: false,
            nzClosable: false,
            nzKeyboard: false,
            nzOnOk: () => {
              authService.clearAuth();
              router.navigate(['/login']);
            },
          });
          return throwError(() => error);
        }

        if (!isAuthEndpoint(req.url)) {
          const path = router.url.split('?')[0].split('#')[0];
          if (path !== '/forbidden') {
            void router.navigate(['/forbidden']);
          }
        }
        return throwError(() => error);
      }

      if (error.status === 401 && errorCode === 'ACCOUNT_INACTIVE') {
        authService.logout();
        const loginPath = router.url.split('?')[0].split('#')[0];
        const isOnLoginPage = loginPath === '/login';
        if (!isOnLoginPage) {
          const modal = injector.get(NzModalService);
          modal.error({
            nzTitle: 'Account Deactivated',
            nzContent:
              'Your access to this hotel has been disabled by the administrator. Please contact your manager for assistance.',
            nzMaskClosable: false,
            nzClosable: false,
            nzKeyboard: false,
            nzOnOk: () => router.navigate(['/login']),
          });
        }
        return throwError(() => error);
      }

      if (
        error.status === 401 &&
        !req.headers.has('X-Skip-Auth-Retry') &&
        !isAuthEndpoint(req.url)
      ) {
        return authService.refreshToken().pipe(
          switchMap((res) => {
            const newToken = authService.getAccessToken();
            if (newToken) {
              const retryReq = req.clone({
                setHeaders: { Authorization: `Bearer ${newToken}` },
                headers: req.headers.set('X-Skip-Auth-Retry', 'true'),
              });
              return next(retryReq);
            }
            router.navigate(['/login']);
            return throwError(() => error);
          }),
          catchError(() => {
            authService.clearAuth();
            router.navigate(['/login']);
            return throwError(() => error);
          })
        );
      }
      return throwError(() => error);
    })
  );
};
