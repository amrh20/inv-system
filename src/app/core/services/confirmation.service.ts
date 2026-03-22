import { Injectable, inject } from '@angular/core';
import { NzModalService } from 'ng-zorro-antd/modal';
import { Observable } from 'rxjs';

export interface ConfirmationOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  confirmDanger?: boolean;
}

@Injectable()
export class ConfirmationService {
  private readonly modal = inject(NzModalService);

  confirm(options: ConfirmationOptions): Observable<boolean> {
    const {
      title,
      message,
      confirmText = 'Confirm',
      cancelText = 'Cancel',
      confirmDanger = false,
    } = options;

    return new Observable<boolean>((observer) => {
      const modalRef = this.modal.confirm({
        nzTitle: title,
        nzContent: message,
        nzOkText: confirmText,
        nzCancelText: cancelText,
        nzOkDanger: confirmDanger,
        nzOnOk: () => {
          observer.next(true);
          observer.complete();
        },
        nzOnCancel: () => {
          observer.next(false);
          observer.complete();
        },
        nzMaskClosable: false,
      });

      return () => {
        modalRef.close();
      };
    });
  }
}
