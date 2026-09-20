import { h } from './dom.js';
import { hidePanel } from './hide.js';
import { revealPanel } from './reveal.js';
import { cipherPanel } from './cipher.js';
import { puzzlePanel } from './puzzle.js';
import { analyzePanel } from './analyze.js';
import { toRunes } from '../ciphers/classic.js';
import { t, detectLang, setLang, getLang, LANGS } from '../i18n.js';

const TABS = [
  ['ocultar', 'Ocultar', hidePanel],
  ['revelar', 'Revelar', revealPanel],
  ['cifrados', 'Cifrados', cipherPanel],
  ['retos', 'Retos', puzzlePanel],
  ['analizar', 'Analizar', analyzePanel],
];

export function mount(root, lang) {
  setLang(lang ?? detectLang());
  root.replaceChildren();
  const nav = h('nav', { class: 'tabs', 'aria-label': t('Herramientas') });
  const main = h('main', { id: 'main' });
  const cache = new Map();   // los paneles se construyen una vez: cambiar de pestaña no pierde lo escrito

  function show(id) {
    const [tabId, , make] = TABS.find((x) => x[0] === id) ?? TABS[0];
    if (!cache.has(tabId)) cache.set(tabId, make());
    main.replaceChildren(cache.get(tabId));
    [...nav.children].forEach((a) => a.setAttribute('aria-current', String(a.dataset.id === tabId)));
    document.title = `umbra · ${t(TABS.find((x) => x[0] === tabId)[1]).toLowerCase()}`;
  }

  TABS.forEach(([id, label]) => nav.append(h('a', { href: `#${id}`, 'data-id': id }, t(label))));
  const onHash = () => show(location.hash.slice(1));
  window.__umbraHash && removeEventListener('hashchange', window.__umbraHash);
  window.__umbraHash = onHash;
  addEventListener('hashchange', onHash);

  const langs = h('div', { class: 'lang', role: 'group', 'aria-label': 'Language / Idioma' },
    LANGS.map(([code, label]) => h('button', { type: 'button', 'aria-pressed': String(getLang() === code), onClick: () => mount(root, code) }, label)));

  root.append(
    h('header', { class: 'top' },
      h('a', { class: 'brand', href: '#ocultar' },
        h('img', { class: 'cicada', src: 'assets/cicada.svg', alt: '', width: 40, height: 40 }),
        h('b', {}, 'umbra'),
        h('span', { class: 'brand-runes', 'aria-hidden': 'true' }, toRunes('umbra'))),
      h('div', { class: 'top-right' }, nav, langs)),
    main,
    h('footer', {}, t('todo se procesa en tu navegador'), ' · ', h('a', { href: 'https://github.com/kisnner26/umbra', rel: 'noopener' }, t('código'))),
  );
  show(location.hash.slice(1));
}
