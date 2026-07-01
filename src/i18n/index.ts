import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from './locales/en.json';
import ja from './locales/ja.json';
// don't want to use this?
// have a look at the Quick start guide
// for passing in lng and translations on init
export const resources = {
  en: {
    translation: en
  },
  ja: {
    translation: ja
  }
};

if (!i18n.isInitialized) {
  // pass the i18n instance to react-i18next.
  // Deterministic initial language so SSR prerender matches first client render.
  // The saved preference is restored post-mount (see +Wrapper) to avoid a
  // hydration mismatch.
  void i18n.use(initReactI18next).init({
    lng: 'ja',
    fallbackLng: 'en',
    debug: false,
    resources,
    interpolation: {
      escapeValue: false // not needed for react as it escapes by default
    }
  });
}

export type Locale = 'en' | 'ja' | string;

export default i18n;
