import { h } from './dom.js';
import { hidePanel } from './hide.js';
import { revealPanel } from './reveal.js';
import { cipherPanel } from './cipher.js';
import { analyzePanel } from './analyze.js';
import { toRunes } from '../ciphers/classic.js';

const TABS = [
  ['ocultar', 'Ocultar', hidePanel],
  ['revelar', 'Revelar', revealPanel],
  ['cifrados', 'Cifrados', cipherPanel],
  ['analizar', 'Analizar', analyzePanel],
];

export function mount(root) {
  const nav = h('nav', { class: 'tabs', 'aria-label': 'Herramientas' });
  const main = h('main', { id: 'main' });
  const cache = new Map();   // los paneles se construyen una vez: cambiar de pestaña no pierde lo escrito

  function show(id) {
    const [tabId, , make] = TABS.find((t) => t[0] === id) ?? TABS[0];
    if (!cache.has(tabId)) cache.set(tabId, make());
    main.replaceChildren(cache.get(tabId));
    [...nav.children].forEach((a) => a.setAttribute('aria-current', String(a.dataset.id === tabId)));
    document.title = `umbra · ${tabId}`;
  }

  TABS.forEach(([id, label]) => nav.append(h('a', { href: `#${id}`, 'data-id': id }, label)));
  addEventListener('hashchange', () => show(location.hash.slice(1)));

  root.append(
    h('header', { class: 'top' },
      h('a', { class: 'brand', href: '#ocultar' }, h('span', { class: 'brand-runes', 'aria-hidden': 'true' }, toRunes('umbra')), h('b', {}, 'umbra')),
      nav),
    main,
    h('footer', {}, 'todo se procesa en tu navegador · ', h('a', { href: 'https://github.com/kisnner26/umbra', rel: 'noopener' }, 'código')),
  );
  show(location.hash.slice(1));
}
