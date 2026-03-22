import { DOCUMENT } from '@angular/common';
import { inject, Injectable, signal } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

export type AppLanguage = 'en' | 'ar';

const STORAGE_KEY = 'app.lang';
const DEFAULT_LANG: AppLanguage = 'en';

@Injectable({ providedIn: 'root' })
export class LanguageService {
  private readonly document = inject(DOCUMENT);
  private readonly translate = inject(TranslateService);

  readonly current = signal<AppLanguage>(DEFAULT_LANG);

  constructor() {
    this.translate.addLangs(['en', 'ar']);
    this.translate.setDefaultLang(DEFAULT_LANG);
    this.setLanguage(this.readSavedLanguage());
  }

  setLanguage(language: AppLanguage): void {
    this.current.set(language);
    this.translate.use(language);
    this.document.documentElement.lang = language;
    this.document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
    localStorage.setItem(STORAGE_KEY, language);
  }

  toggleLanguage(): void {
    this.setLanguage(this.current() === 'en' ? 'ar' : 'en');
  }

  private readSavedLanguage(): AppLanguage {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved === 'ar' ? 'ar' : DEFAULT_LANG;
  }
}
