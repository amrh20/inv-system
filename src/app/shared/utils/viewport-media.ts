import { isPlatformBrowser } from '@angular/common';
import { DestroyRef, inject, PLATFORM_ID, signal, type Signal } from '@angular/core';

/**
 * `true` when `window.matchMedia('(min-width: …)')` matches.
 * Use from a component field initializer (injection context). Listens for resize.
 */
export function injectMatchMinWidth(minWidthPx: number): Signal<boolean> {
  const platformId = inject(PLATFORM_ID);
  const destroyRef = inject(DestroyRef);
  const matches = signal(
    isPlatformBrowser(platformId) && typeof window !== 'undefined'
      ? window.matchMedia(`(min-width: ${minWidthPx}px)`).matches
      : false,
  );
  if (isPlatformBrowser(platformId)) {
    const mq = window.matchMedia(`(min-width: ${minWidthPx}px)`);
    const onChange = (): void => {
      matches.set(mq.matches);
    };
    mq.addEventListener('change', onChange);
    destroyRef.onDestroy(() => mq.removeEventListener('change', onChange));
  }
  return matches;
}
