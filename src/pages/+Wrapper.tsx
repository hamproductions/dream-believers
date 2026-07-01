import React, { useEffect, useLayoutEffect } from 'react';
import { HelmetProvider } from 'react-helmet-async';
import i18n from '../i18n';
import ErrorBoundary from '~/components/utils/ErrorBoundary';
import { ColorModeProvider } from '~/context/ColorModeContext';
import { ToasterProvider } from '~/context/ToasterContext';

import '../index.css';
import { SentryProvider } from '~/components/utils/SentryContext';

// Runs before the browser paints on the client, so the saved/browser language
// is applied without a visible flash of the SSR-default Japanese; no-op on the
// server (SSR renders the deterministic default).
const useIsomorphicLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

export function Wrapper({ children }: { children: React.ReactNode }) {
  useIsomorphicLayoutEffect(() => {
    const saved = localStorage.getItem('i18nextLng');
    if (saved) {
      if (saved !== i18n.language) void i18n.changeLanguage(saved);
      return;
    }
    const lang = (navigator.language || '').toLowerCase().startsWith('ja') ? 'ja' : 'en';
    if (lang !== i18n.language) void i18n.changeLanguage(lang);
  }, []);

  return (
    <HelmetProvider>
      <SentryProvider>
        <ErrorBoundary>
          <ColorModeProvider>
            <ToasterProvider>{children}</ToasterProvider>
          </ColorModeProvider>
        </ErrorBoundary>
      </SentryProvider>
    </HelmetProvider>
  );
}
