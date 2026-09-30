'use client';

import { useEffect } from 'react';
import { MARKUP } from './markup';

declare global {
  interface Window {
    __contextTalkStarted?: boolean;
  }
}

export default function Page() {
  useEffect(() => {
    // Скрипт приложения запускается один раз после монтирования разметки
    // (защита от двойного вызова эффекта в React StrictMode).
    if (window.__contextTalkStarted) return;
    window.__contextTalkStarted = true;
    const script = document.createElement('script');
    script.src = '/contexttalk.js';
    script.async = false;
    document.body.appendChild(script);
  }, []);

  // display: contents — обёртка не влияет на вёрстку.
  return (
    <div
      style={{ display: 'contents' }}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: MARKUP }}
    />
  );
}
