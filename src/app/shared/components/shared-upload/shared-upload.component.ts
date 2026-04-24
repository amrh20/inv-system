import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzMessageService } from 'ng-zorro-antd/message';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { LucideAngularModule } from 'lucide-angular';
import { FileText, UploadCloud, X } from 'lucide-angular';

@Component({
  selector: 'app-shared-upload',
  standalone: true,
  imports: [NzButtonModule, TranslatePipe, LucideAngularModule],
  templateUrl: './shared-upload.component.html',
  styleUrl: './shared-upload.component.scss',
})
export class SharedUploadComponent {
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);

  readonly accept = input<string>('');
  readonly label = input<string>('');
  readonly existingPreview = input<string>('');

  readonly fileChanged = output<File | null>();

  readonly lucideUploadCloud = UploadCloud;
  readonly lucideFileText = FileText;
  readonly lucideX = X;

  readonly selectedFile = signal<File | null>(null);
  readonly selectedPreviewUrl = signal<string | null>(null);
  readonly previewVisible = signal(false);
  readonly fromExistingPreview = signal(false);

  readonly isImageFile = computed(() => {
    const file = this.selectedFile();
    if (!file) {
      return !!this.selectedPreviewUrl();
    }
    return file.type.startsWith('image/');
  });

  readonly displayFileName = computed(() => {
    const file = this.selectedFile();
    if (file) {
      return file.name;
    }
    if (this.fromExistingPreview()) {
      return this.extractName(this.existingPreview());
    }
    return '';
  });

  constructor() {
    effect(() => {
      const incoming = this.existingPreview();
      if (this.selectedFile()) {
        return;
      }
      if (!incoming) {
        this.selectedPreviewUrl.set(null);
        this.fromExistingPreview.set(false);
        this.previewVisible.set(false);
        return;
      }
      this.selectedPreviewUrl.set(incoming);
      this.fromExistingPreview.set(true);
      this.previewVisible.set(true);
    });
  }

  onFilePicked(event: Event): void {
    const inputEl = event.target as HTMLInputElement;
    const file = inputEl.files?.[0] ?? null;
    inputEl.value = '';
    if (!file) {
      return;
    }
    if (!this.isAcceptedType(file)) {
      this.message.warning(this.translate.instant('COMMON.INVALID_FILE_TYPE'));
      return;
    }
    this.setSelectedFile(file);
  }

  removeFile(event?: Event): void {
    event?.stopPropagation();
    this.revokeObjectPreviewIfNeeded();
    this.selectedFile.set(null);
    this.selectedPreviewUrl.set(null);
    this.fromExistingPreview.set(false);
    this.previewVisible.set(false);
    this.fileChanged.emit(null);
  }

  private setSelectedFile(file: File): void {
    this.revokeObjectPreviewIfNeeded();
    this.selectedFile.set(file);
    this.fromExistingPreview.set(false);
    if (file.type.startsWith('image/')) {
      this.selectedPreviewUrl.set(URL.createObjectURL(file));
      this.previewVisible.set(true);
    } else {
      this.selectedPreviewUrl.set(null);
      this.previewVisible.set(false);
    }
    this.fileChanged.emit(file);
  }

  private revokeObjectPreviewIfNeeded(): void {
    const preview = this.selectedPreviewUrl();
    if (preview?.startsWith('blob:')) {
      URL.revokeObjectURL(preview);
    }
  }

  private isAcceptedType(file: File): boolean {
    const rawAccept = this.accept().trim();
    if (!rawAccept) {
      return true;
    }
    const tokens = rawAccept
      .split(',')
      .map((t) => t.trim().toLowerCase())
      .filter((t) => !!t);
    if (tokens.length === 0) {
      return true;
    }
    const fileName = file.name.toLowerCase();
    const mimeType = (file.type || '').toLowerCase();
    return tokens.some((token) => {
      if (token.startsWith('.')) {
        return fileName.endsWith(token);
      }
      if (token.endsWith('/*')) {
        const prefix = token.slice(0, token.length - 1);
        return mimeType.startsWith(prefix);
      }
      return mimeType === token;
    });
  }

  private extractName(pathOrUrl: string): string {
    const clean = pathOrUrl.split('?')[0] ?? '';
    const chunks = clean.split('/');
    return chunks[chunks.length - 1] ?? clean;
  }
}
