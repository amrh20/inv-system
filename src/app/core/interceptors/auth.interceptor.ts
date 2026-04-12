import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject, Injector } from '@angular/core';
import { NzModalService } from 'ng-zorro-antd/modal';
import { Router } from '@angular/router';
import { catchError, firstValueFrom, from, map, switchMap, throwError, type Observable } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';
import { environment } from '../../../environments/environment';
import { AuthService } from '../services/auth.service';
import { SubscriptionNoticeService } from '../services/subscription-notice.service';
import {
  getSubscriptionExpiredMessage,
  isSubscriptionError,
} from '../utils/subscription-http-error.util';

const isAuthEndpoint = (url: string) =>
  url.includes('/auth/login') || url.includes('/auth/refresh');

/** Single-flight refresh so concurrent 401s share one /auth/refresh call. */
let refreshChain: Promise<string | null> | null = null;

function silentRefreshAccessToken(authService: AuthService): Observable<string | null> {
  if (!refreshChain) {
    refreshChain = firstValueFrom(
      authService.refreshToken().pipe(map(() => authService.getAccessToken())),
    ).finally(() => {
      refreshChain = null;
    });
  }
  return from(refreshChain);
}

const shouldAttemptSilentRefresh = (error: HttpErrorResponse): boolean => {
  const errorCode = error.error?.error ?? error.error?.code;
  return errorCode === 'TOKEN_EXPIRED' || errorCode === 'PERMISSIONS_STALE';
};

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

  let outgoing = req;
  if (req.url.startsWith(environment.apiUrl)) {
    outgoing = outgoing.clone({ withCredentials: true });
  }

  const cloned = token
    ? outgoing.clone({
        setHeaders: { Authorization: `Bearer ${token}` },
      })
    : outgoing;

  return next(cloned).pipe(
    catchError((error: HttpErrorResponse) => {
      const errorCode = error.error?.error ?? error.error?.code;

      if (isSubscriptionError(error)) {
        const notice = injector.get(SubscriptionNoticeService);
        // clearAuth first so resetSession() runs before showExpiredNotice — avoids a second
        // modal when feature subscribers (e.g. dashboard) also handle the same error.
        authService.clearAuth();
        notice.showExpiredNotice(getSubscriptionExpiredMessage(error));
        void router.navigate(['/login'], { replaceUrl: true });
        return throwError(() => error);
      }

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
        shouldAttemptSilentRefresh(error) &&
        !req.headers.has('X-Skip-Auth-Retry') &&
        !isAuthEndpoint(req.url)
      ) {
        return silentRefreshAccessToken(authService).pipe(
          switchMap((newToken) => {
            if (!newToken) {
              authService.clearAuth();
              void router.navigate(['/login'], { replaceUrl: true });
              return throwError(() => error);
            }
            const retryBase = req.url.startsWith(environment.apiUrl)
              ? req.clone({ withCredentials: true })
              : req;
            const retryReq = retryBase.clone({
              setHeaders: { Authorization: `Bearer ${newToken}` },
              headers: retryBase.headers.set('X-Skip-Auth-Retry', 'true'),
            });
            return next(retryReq);
          }),
          catchError(() => {
            authService.clearAuth();
            void router.navigate(['/login'], { replaceUrl: true });
            return throwError(() => error);
          }),
        );
      }
      return throwError(() => error);
    })
  );
};
