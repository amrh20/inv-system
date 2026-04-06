import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { NzMessageService } from 'ng-zorro-antd/message';
import { TranslateService } from '@ngx-translate/core';
import { catchError, throwError } from 'rxjs';
import { isReferentialIntegrityError } from '../../features/master-data/shared/master-data-error.util';

export const apiErrorInterceptor: HttpInterceptorFn = (req, next) => {
  const message = inject(NzMessageService);
  const translate = inject(TranslateService);
  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      const isMutation = req.method !== 'GET';
      if (isMutation && isReferentialIntegrityError(error)) {
        message.error(translate.instant('COMMON.RECORD_IN_USE'));
      }
      return throwError(() => error);
    }),
  );
};
