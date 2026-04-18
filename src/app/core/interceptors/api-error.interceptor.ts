import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { NzMessageService } from 'ng-zorro-antd/message';
import { TranslateService } from '@ngx-translate/core';
import { catchError, throwError } from 'rxjs';
import { isReferentialIntegrityError } from '../../features/master-data/shared/master-data-error.util';

/** Backend validation payload: `{ success, message, errors: [{ field, message }] }` */
type ApiValidationErrorItem = { field?: string; message?: string };
type ApiValidationBody = {
  success?: boolean;
  message?: string;
  errors?: ApiValidationErrorItem[];
};

function parseErrorBody(error: HttpErrorResponse): unknown {
  return error.error;
}

/**
 * Formats API validation errors for display. Returns null if the body is not this shape.
 */
function formatApiValidationErrors(body: unknown): string | null {
  if (!body || typeof body !== 'object') return null;
  const { errors, message } = body as ApiValidationBody;
  if (!Array.isArray(errors) || errors.length === 0) return null;

  const lines = errors
    .map((e) => {
      const field = e.field != null ? String(e.field).trim() : '';
      const msg = e.message != null ? String(e.message).trim() : '';
      if (field && msg) return `${field}: ${msg}`;
      return msg || field;
    })
    .filter((line) => line.length > 0);

  if (lines.length === 0) return null;

  const header =
    typeof message === 'string' && message.trim().length > 0 ? `${message.trim()}\n` : '';
  return header + lines.join('\n');
}

function validationToastDuration(text: string): number {
  const lineCount = text.split('\n').length;
  return Math.min(14000, 3500 + Math.max(0, lineCount - 1) * 1200);
}

export const apiErrorInterceptor: HttpInterceptorFn = (req, next) => {
  const message = inject(NzMessageService);
  const translate = inject(TranslateService);
  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      const isMutation = req.method !== 'GET';
      if (isMutation && isReferentialIntegrityError(error)) {
        message.error(translate.instant('COMMON.RECORD_IN_USE'));
        return throwError(() => error);
      }

      if (error.status === 400) {
        const validationText = formatApiValidationErrors(parseErrorBody(error));
        if (validationText) {
          message.error(validationText, { nzDuration: validationToastDuration(validationText) });
          return throwError(() => error);
        }
      }

      return throwError(() => error);
    }),
  );
};
