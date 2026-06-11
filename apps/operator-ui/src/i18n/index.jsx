import { createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react';
import en from './en.js';
import ar from './ar.js';

const DICTS = { en, ar };
const I18nContext = createContext(null);

function resolve(dict, path) {
  return path.split('.').reduce((acc, k) => (acc == null ? undefined : acc[k]), dict);
}

export function I18nProvider({ children }) {
  const [lang, setLang] = useState('en');

  const dir = DICTS[lang].dir;

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = dir;
  }, [lang, dir]);

  const t = useCallback(
    (key) => {
      const v = resolve(DICTS[lang], key);
      if (v === undefined) {
        const fb = resolve(DICTS.en, key);
        return fb === undefined ? key : fb;
      }
      return v;
    },
    [lang]
  );

  const value = useMemo(() => ({ lang, dir, setLang, t }), [lang, dir, t]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within I18nProvider');
  return ctx;
}
