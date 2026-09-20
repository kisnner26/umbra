import { en } from './i18n/en.js';

// El español es el idioma de origen: las claves son el texto en español. `t('texto {n}', { n: 3 })`.
const STORAGE = 'umbra.lang';
let lang = 'es';

export const LANGS = [['es', 'ES'], ['en', 'EN']];

export function detectLang() {
  try {
    const saved = localStorage.getItem(STORAGE);
    if (saved === 'es' || saved === 'en') return saved;
  } catch { /* sin almacenamiento: se usa el idioma del navegador */ }
  return (globalThis.navigator?.language ?? 'es').toLowerCase().startsWith('es') ? 'es' : 'en';
}

export function setLang(l) {
  lang = l === 'en' ? 'en' : 'es';
  try { localStorage.setItem(STORAGE, lang); } catch { /* da igual */ }
  if (globalThis.document) document.documentElement.lang = lang;
}

export const getLang = () => lang;

export function t(key, vars) {
  const text = (lang === 'en' && en[key]) || key;
  return vars ? text.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m)) : text;
}
