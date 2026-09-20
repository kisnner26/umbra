import { h } from './dom.js';
import { ciphers, cipherById, gematria } from '../ciphers/index.js';
import { RUNES } from '../ciphers/runes.js';
import { toRunes } from '../ciphers/classic.js';

/** Panel "Cifrados": los cifrados de texto clasicos y de runas, con la gematria. */
export function cipherPanel() {
  const s = { id: 'runes', key: '', dir: 'encode' };
  const root = h('section', { class: 'panel', 'aria-label': 'Cifrados' });
  const select = h('select', { onChange: () => { s.id = select.value; run(); syncKey(); } }, ciphers.map((c) => h('option', { value: c.id }, c.name)));
  const key = h('input', { type: 'text', spellcheck: false, autocomplete: 'off', onInput: () => { s.key = key.value; run(); } });
  const keyField = h('label', { class: 'field' }, h('span', { class: 'label' }, 'clave'), key);
  const input = h('textarea', { rows: 4, placeholder: 'texto de entrada', onInput: run });
  const output = h('textarea', { rows: 4, readOnly: true, placeholder: 'resultado' });
  const gem = h('small', { class: 'gem' });
  const err = h('small', { class: 'err' });

  const dirSeg = h('div', { class: 'seg' },
    [['encode', 'cifrar'], ['decode', 'descifrar']].map(([v, t]) => h('button', { type: 'button', 'aria-selected': String(s.dir === v), onClick: (e) => { s.dir = v; [...dirSeg.children].forEach((b) => b.setAttribute('aria-selected', 'false')); e.target.setAttribute('aria-selected', 'true'); run(); } }, t)));

  function syncKey() {
    const c = cipherById(s.id);
    keyField.style.display = c.key === 'none' ? 'none' : '';
    key.type = 'text';
    key.placeholder = c.key === 'number' ? 'un número, p. ej. 3' : 'letras, p. ej. DIVINITY';
  }

  function run() {
    err.textContent = '';
    const c = cipherById(s.id);
    try {
      const k = c.key === 'number' ? (Number.isFinite(+s.key) && s.key !== '' ? +s.key : 0) : s.key;
      output.value = input.value ? c[s.dir](input.value, k) : '';
    } catch (e) { output.value = ''; err.textContent = e.message; }
    const sample = /[ᚠ-ᛰ]/.test(output.value) ? output.value : /[ᚠ-ᛰ]/.test(input.value) ? input.value : toRunes(input.value);
    gem.textContent = input.value ? `gematria del texto en runas: ${gematria(sample)}` : '';
  }

  const table = h('table', { class: 'runes' },
    h('thead', {}, h('tr', {}, ['runa', 'letra', 'primo', 'índice'].map((t) => h('th', {}, t)))),
    h('tbody', {}, RUNES.map(([r, l, p], i) => h('tr', {}, h('td', { class: 'rune', onClick: () => { input.value += r; run(); }, title: 'clic para añadirla' }, r), h('td', {}, l), h('td', {}, p), h('td', {}, i)))));

  root.append(
    h('h2', {}, 'Cifrados'),
    h('p', { class: 'lede' }, 'Runas del Liber Primus, César, Atbash y Vigenère (también sobre el alfabeto rúnico de 29 letras). Cada uno se puede encadenar con lo que ocultas en los otros paneles.'),
    h('label', { class: 'field' }, h('span', { class: 'label' }, 'cifrado'), select), keyField, dirSeg, input, output, err, gem,
    h('h3', {}, 'Gematria Primus'), table,
  );
  syncKey(); run();
  return root;
}
