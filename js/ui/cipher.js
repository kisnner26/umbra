import { h } from './dom.js';
import { ciphers, cipherById, gematria } from '../ciphers/index.js';
import { RUNES } from '../ciphers/runes.js';
import { toRunes } from '../ciphers/classic.js';
import { t } from '../i18n.js';

/** Panel "Cifrados": los cifrados de texto clásicos y de runas, con la gematria. */
export function cipherPanel() {
  const s = { id: 'runes', key: '', dir: 'encode' };
  const root = h('section', { class: 'panel', 'aria-label': t('Cifrados') });
  const select = h('select', { onChange: () => { s.id = select.value; run(); syncKey(); } }, ciphers.map((c) => h('option', { value: c.id }, t(c.name))));
  const key = h('input', { type: 'text', spellcheck: false, autocomplete: 'off', onInput: () => { s.key = key.value; run(); } });
  const keyField = h('label', { class: 'field' }, h('span', { class: 'label' }, t('clave')), key);
  const input = h('textarea', { rows: 4, placeholder: t('texto de entrada'), onInput: run });
  const output = h('textarea', { rows: 4, readOnly: true, placeholder: t('resultado') });
  const gem = h('small', { class: 'gem' });
  const err = h('small', { class: 'err' });

  const dirSeg = h('div', { class: 'seg' },
    [['encode', t('cifrar')], ['decode', t('descifrar')]].map(([v, text]) => h('button', { type: 'button', 'aria-selected': String(s.dir === v), onClick: (e) => { s.dir = v; [...dirSeg.children].forEach((b) => b.setAttribute('aria-selected', 'false')); e.target.setAttribute('aria-selected', 'true'); run(); } }, text)));

  function syncKey() {
    const c = cipherById(s.id);
    keyField.style.display = c.key === 'none' ? 'none' : '';
    key.placeholder = c.key === 'number' ? t('un número, p. ej. 3') : t('letras, p. ej. DIVINITY');
  }

  function run() {
    err.textContent = '';
    const c = cipherById(s.id);
    try {
      const k = c.key === 'number' ? (Number.isFinite(+s.key) && s.key !== '' ? +s.key : 0) : s.key;
      output.value = input.value ? c[s.dir](input.value, k) : '';
    } catch (e) { output.value = ''; err.textContent = t(e.message); }
    const sample = /[ᚠ-ᛰ]/.test(output.value) ? output.value : /[ᚠ-ᛰ]/.test(input.value) ? input.value : toRunes(input.value);
    gem.textContent = input.value ? t('gematria del texto en runas: {n}', { n: gematria(sample) }) : '';
  }

  const table = h('table', { class: 'rune-table' },
    h('thead', {}, h('tr', {}, [t('runa'), t('letra'), t('primo'), t('índice')].map((x) => h('th', {}, x)))),
    h('tbody', {}, RUNES.map(([r, l, p], i) => h('tr', {}, h('td', { class: 'rune', onClick: () => { input.value += r; run(); }, title: t('clic para añadirla') }, r), h('td', {}, l), h('td', {}, p), h('td', {}, i)))));

  root.append(
    h('h2', {}, t('Cifrados')),
    h('p', { class: 'lede' }, t('Runas del Liber Primus, César, Atbash y Vigenère (también sobre el alfabeto rúnico de 29 letras). Cada uno se puede encadenar con lo que ocultas en los otros paneles.')),
    h('label', { class: 'field' }, h('span', { class: 'label' }, t('cifrado')), select), keyField, dirSeg, input, output, err, gem,
    h('h3', {}, 'Gematria Primus'), table,
  );
  syncKey(); run();
  return root;
}
