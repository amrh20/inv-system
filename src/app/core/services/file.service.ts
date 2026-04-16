import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, type Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { ApiResponse } from '../models/api-response.model';

@Injectable({ providedIn: 'root' })
export class FileService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/files`;

  upload(file: File): Observable<string> {
    const fd = new FormData();
    fd.append('file', file);
    return this.http.post<ApiResponse<unknown>>(`${this.base}/upload`, fd).pipe(
      map((res) => {
        if (!res.success || !res.data) {
          throw new Error(res.message || 'Upload failed');
        }
        const data = res.data as Record<string, unknown>;
        const path =
          (typeof data['url'] === 'string' && data['url']) ||
          (typeof data['path'] === 'string' && data['path']) ||
          (typeof data['filePath'] === 'string' && data['filePath']) ||
          '';
        if (!path) {
          throw new Error(res.message || 'Upload failed');
        }
        return path;
      }),
    );
  }
}
