import { h, download, formatBytes } from './dom.js';
import { fileDrop, notice } from './widgets.js';
import { fileToPixels, pixelsToCanvas, canvasToPng, generateFlatCover } from './image-io.js';
import { buildChain, solveChain, solutionSheet } from '../puzzle/chain.js';
import { ciphers, cipherById } from '../ciphers/index.js';
import { toRunes } from '../ciphers/classic.js';
import { t } from '../i18n.js';

const MAX_LEVELS = 5;

/** un reto de ejemplo con tres niveles que se resuelven con las herramientas de la propia app. */
const EXAMPLE = () => [
  { pass: 'primus', message: 'the key to the next door is the gematria of the word primus', cipher: { id: 'runes', key: '' }, clue: 'count the primes', carrier: null },
  { pass: '212', message: 'the last key is liber', cipher: { id: 'caesar', key: '3' }, clue: 'three steps back', carrier: null },
  { pass: 'liber', message: 'you are not the first. you will not be the last.', cipher: { id: 'none', key: '' }, clue: '', carrier: null },
];
const blank = () => ({ pass: '', message: '', cipher: { id: 'none', key: '' }, clue: '', carrier: null });

/** Panel "Retos": construye una cadena de imágenes anidadas, cada una con su clave, su mensaje y sus runas. */
export function puzzlePanel() {
  const s = { levels: EXAMPLE(), busy: false };
  const root = h('section', { class: 'panel', 'aria-label': t('Retos') });
  const list = h('div', { class: 'levels' }), out = h('div', { class: 'result', 'aria-live': 'polite' });
  const build = h('button', { class: 'primary', type: 'button', onClick: run }, t('construir el reto'));
  const add = h('button', { class: 'ghost', type: 'button', onClick: () => { if (s.levels.length < MAX_LEVELS) { s.levels.push(blank()); draw(); } } }, t('+ añadir un nivel'));

  function draw() {
    list.replaceChildren(...s.levels.map(card));
    add.disabled = s.levels.length >= MAX_LEVELS;
  }

  function card(level, i) {
    const cipher = cipherById(level.cipher.id);
    const keyIn = h('input', { type: 'text', value: level.cipher.key, spellcheck: false, autocomplete: 'off', placeholder: cipher?.key === 'number' ? t('un número, p. ej. 3') : t('letras, p. ej. DIVINITY'), onInput: () => { level.cipher.key = keyIn.value; } });
    const keyField = h('label', { class: 'field' }, h('span', { class: 'label' }, t('clave del cifrado')), keyIn);
    keyField.style.display = !cipher || cipher.key === 'none' ? 'none' : '';
    const sel = h('select', { onChange: () => { level.cipher.id = sel.value; const c = cipherById(sel.value); keyField.style.display = !c || c.key === 'none' ? 'none' : ''; keyIn.placeholder = c?.key === 'number' ? t('un número, p. ej. 3') : t('letras, p. ej. DIVINITY'); } },
      h('option', { value: 'none' }, t('sin cifrar')), ciphers.map((c) => h('option', { value: c.id, selected: c.id === level.cipher.id }, t(c.name))));
    const last = i === s.levels.length - 1;
    return h('article', { class: 'level' },
      h('header', {}, h('b', {}, t('nivel {n}', { n: i + 1 })), i === 0 ? h('small', {}, t('la imagen que publicas')) : last ? h('small', {}, t('el final')) : null,
        s.levels.length > 1 && h('button', { class: 'ghost', type: 'button', 'aria-label': t('quitar el nivel {n}', { n: i + 1 }), onClick: () => { s.levels.splice(i, 1); draw(); } }, '×')),
      h('label', { class: 'field' }, h('span', { class: 'label' }, t('clave que abre este nivel')), h('input', { type: 'text', value: level.pass, spellcheck: false, autocomplete: 'off', onInput: (e) => { level.pass = e.target.value; } })),
      h('label', { class: 'field' }, h('span', { class: 'label' }, t('mensaje que verá quien lo abra')), h('textarea', { rows: 2, value: level.message, onInput: (e) => { level.message = e.target.value; } })),
      h('label', { class: 'field' }, h('span', { class: 'label' }, t('cifrado del mensaje')), sel), keyField,
      h('label', { class: 'field' }, h('span', { class: 'label' }, t('pista dibujada en la imagen (se convierte en runas)')), h('input', { type: 'text', value: level.clue, spellcheck: false, placeholder: t('opcional'), onInput: (e) => { level.clue = e.target.value; } })),
      h('details', {}, h('summary', {}, level.carrier ? t('portador propio: {name}', { name: level.carrier.name }) : t('portador: imagen generada (o sube la tuya)')),
        fileDrop({ label: t('suelta tu imagen; tiene que ser lo bastante grande para llevar todo lo de dentro'), accept: 'image/*', onFile: async (f) => { level.carrier = { ...(await fileToPixels(f)), name: f.name }; draw(); } }),
        level.carrier && h('button', { class: 'ghost', type: 'button', onClick: () => { level.carrier = null; draw(); } }, t('volver a la imagen generada'))),
    );
  }

  /** portadores: el propio si lo hay; si no, una imagen generada del tamaño justo para lo que tiene que llevar. */
  const io = {
    makeCarrier(level, index, needed) {
      if (level.carrier) return { ...level.carrier, pixels: Uint8ClampedArray.from(level.carrier.pixels) };
      const side = Math.max(128, Math.ceil(Math.sqrt((needed * 8) / 3 + 64)));
      const c = generateFlatCover(side, 1000 + index * 7919 + (level.pass.length + 1) * 31, { clue: level.clue ? toRunes(level.clue) : '' });
      const d = c.getContext('2d').getImageData(0, 0, side, side);
      return { width: side, height: side, pixels: d.data };
    },
    async encodeImage({ pixels, width, height }) {
      return new Uint8Array(await (await canvasToPng(pixelsToCanvas(pixels, width, height))).arrayBuffer());
    },
    async decodeImage(bytes) { return fileToPixels(new Blob([bytes], { type: 'image/png' })); },
  };

  async function run() {
    s.busy = true; build.disabled = true; build.textContent = t('construyendo…'); out.replaceChildren();
    try {
      const levels = s.levels.map((l) => ({ pass: l.pass.trim(), message: l.message, cipher: l.cipher.id === 'none' ? null : { id: l.cipher.id, key: cipherById(l.cipher.id)?.key === 'number' ? +l.cipher.key || 0 : l.cipher.key }, clue: l.clue }));
      const chain = await buildChain(levels, { makeCarrier: (l, i, n) => io.makeCarrier({ ...l, carrier: s.levels[i].carrier }, i, n), encodeImage: io.encodeImage });
      // se comprueba de verdad: se abre el reto de arriba abajo con las claves como las teclearia un jugador
      const check = await solveChain(chain.first, levels.map((l) => l.pass), io);
      const ok = check.length === levels.length;
      const sheet = solutionSheet(chain.solution, t('reto de umbra'));
      out.append(
        ok ? notice('ok', t('reto construido y comprobado: se abre entero con las claves de la ficha.')) : notice('error', t('el reto no se pudo abrir de arriba abajo: revisa las claves.')),
        h('div', { class: 'levels-out' }, chain.images.map((bytes, i) => h('figure', {},
          h('img', { src: URL.createObjectURL(new Blob([bytes], { type: 'image/png' })), alt: t('nivel {n}', { n: i + 1 }) }),
          h('figcaption', {}, `${t('nivel {n}', { n: i + 1 })} · ${formatBytes(bytes.length)}${i === 0 ? ' · ' + t('esta es la que publicas') : ''}`),
          h('button', { class: 'ghost', type: 'button', onClick: () => download(new Blob([bytes], { type: 'image/png' }), `umbra-reto-nivel-${i + 1}.png`) }, t('descargar')),
        ))),
        h('div', { class: 'row-actions' },
          h('button', { class: 'primary', type: 'button', onClick: () => download(new Blob([chain.first], { type: 'image/png' }), 'umbra-reto.png') }, t('descargar el reto (nivel 1)')),
          h('button', { class: 'ghost', type: 'button', onClick: () => download(new Blob([sheet], { type: 'text/markdown' }), 'umbra-reto-ficha.md') }, t('descargar la ficha con las claves')),
        ),
        h('small', {}, t('publica solo la imagen del nivel 1: las demás van dentro. Quien la resuelva usa la pestaña Revelar y, para las runas, la pestaña Cifrados.')),
      );
    } catch (e) {
      out.append(notice('error', e.code === 'capacity' ? t('el portador del nivel {n} es demasiado pequeño para lo que tiene que llevar dentro.', { n: e.detail.level }) : t(e.message) + (e.detail?.level ? ` (${t('nivel {n}', { n: e.detail.level })})` : '')));
    } finally {
      s.busy = false; build.disabled = false; build.textContent = t('construir el reto');
    }
  }

  root.append(
    h('h2', {}, t('Retos')),
    h('p', { class: 'lede' }, t('Encadena imágenes: el nivel 1 lleva un mensaje y, dentro, la imagen del nivel 2; esa, con otra clave, la del 3… Como los acertijos de Cicada, pero los haces tú.')),
    h('p', { class: 'lede' }, t('Cada mensaje puede ir en runas o con otro cifrado, y la pista visible se dibuja en la imagen. Las claves del ejemplo se deducen con la pestaña Cifrados.')),
    list, h('div', { class: 'row-actions' }, add, h('button', { class: 'ghost', type: 'button', onClick: () => { s.levels = EXAMPLE(); out.replaceChildren(); draw(); } }, t('cargar el ejemplo'))),
    build, out,
  );
  draw();
  return root;
}
