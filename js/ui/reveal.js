import { h, put, download, formatBytes } from './dom.js';
import { fileDrop, passField, notice, segmented } from './widgets.js';
import { fileToPixels } from './image-io.js';
import { RgbaCarrier } from '../carriers/rgba.js';
import { WavCarrier } from '../carriers/wav.js';
import { extractFromText } from '../carriers/zerowidth.js';
import { extract } from '../core/engine.js';
import { TYPE } from '../core/frame.js';
import { unpackBundle } from '../core/bundle.js';
import { dec } from '../core/bytes.js';
import { t } from '../i18n.js';

/** Panel "Revelar": lee un mensaje de una imagen, un WAV o un texto. Si el resultado es un paquete de reto, permite seguir. */
export function revealPanel() {
  const s = { mode: 'image', carrier: null, text: '', pass: '', name: '' };
  const root = h('section', { class: 'panel', 'aria-label': t('Revelar') });
  const input = h('div'), out = h('div', { class: 'result', 'aria-live': 'polite' });
  const go = h('button', { class: 'primary', type: 'button', onClick: run, disabled: true }, t('revelar'));
  let passInput;

  const seg = segmented([['image', t('imagen')], ['audio', t('audio WAV')], ['text', t('texto')]], s.mode, (v) => { s.mode = v; s.carrier = null; s.name = ''; out.replaceChildren(); draw(); });

  function draw() {
    input.replaceChildren();
    go.disabled = !s.carrier;
    if (s.mode === 'text') {
      const ta = h('textarea', { rows: 5, placeholder: t('pega aquí el texto con el mensaje invisible'), onInput: () => { s.text = ta.value; go.disabled = !ta.value; } });
      input.append(ta);
      return;
    }
    input.append(fileDrop({
      label: s.name ? t('{name} cargado', { name: s.name }) : (s.mode === 'image' ? t('suelta la imagen (PNG)') : t('suelta el WAV')),
      accept: s.mode === 'image' ? 'image/*' : 'audio/wav,.wav',
      onFile: async (f) => {
        try {
          s.name = f.name;
          s.carrier = s.mode === 'image' ? new RgbaCarrier((await fileToPixels(f)).pixels) : new WavCarrier(new Uint8Array(await f.arrayBuffer()));
          draw();
        } catch (e) { out.replaceChildren(notice('error', t(e.message))); }
      },
    }));
  }

  /** carga en el panel la imagen que acaba de salir de un paquete, lista para probar la siguiente clave. */
  async function follow(file) {
    const blob = new Blob([file.data], { type: 'image/png' });
    s.mode = 'image'; s.name = file.name; s.pass = '';
    s.carrier = new RgbaCarrier((await fileToPixels(blob)).pixels);
    passInput.value = '';
    seg.set('image');
    draw();
    out.replaceChildren(notice('ok', t('{name} cargado: escribe su clave y pulsa revelar.', { name: file.name })));
    passInput.focus();
  }

  function showBundle(b) {
    put(out, notice('ok', t('nivel abierto')));
    if (b.text) {
      put(out,
        h('pre', { class: 'plain' }, b.text),
        /[ᚠ-ᛰ]/.test(b.text) && h('small', {}, t('hay runas: pásalas por la pestaña Cifrados para leerlas.')),
      );
    }
    for (const f of b.files) {
      put(out, h('div', { class: 'file' },
        h('span', {}, `${f.name} (${formatBytes(f.data.length)})`),
        /\.png$/i.test(f.name) && h('button', { class: 'primary', type: 'button', onClick: () => follow(f) }, t('seguir con esta imagen →')),
        h('button', { class: 'ghost', type: 'button', onClick: () => download(new Blob([f.data]), f.name) }, t('descargar')),
      ));
    }
    if (!b.files.length) put(out, h('small', {}, t('no hay más niveles dentro: es el final del reto.')));
  }

  async function run() {
    out.replaceChildren();
    go.textContent = t('buscando…'); go.disabled = true;
    try {
      const r = s.mode === 'text' ? await extractFromText(s.text, s.pass) : await extract(s.carrier, s.pass);
      if (r.type === TYPE.bundle) {
        showBundle(unpackBundle(r.data));
      } else if (r.type === TYPE.text) {
        out.append(notice('ok', t('mensaje encontrado')), h('pre', { class: 'plain' }, dec.decode(r.data)));
      } else {
        const blob = new Blob([r.data]);
        const isImg = /\.(png|jpe?g|gif|webp|bmp)$/i.test(r.name);
        put(out,
          notice('ok', t('archivo encontrado: {name} ({size})', { name: r.name || t('sin nombre'), size: formatBytes(r.data.length) })),
          isImg && h('img', { class: 'found', src: URL.createObjectURL(new Blob([r.data])), alt: t('imagen encontrada') }),
          h('button', { class: 'primary', type: 'button', onClick: () => download(blob, r.name || 'umbra.bin') }, t('descargar')),
        );
      }
    } catch (e) {
      out.append(notice('error', e.code === 'wrongkey' || e.code === 'nomessage'
        ? t('No se encontró ningún mensaje con esta clave. Puede que la clave sea otra, que el archivo se haya recomprimido (JPG, WhatsApp…) o que no haya nada escondido. Por diseño no se puede distinguir cuál.')
        : t(e.message)));
    } finally { go.textContent = t('revelar'); go.disabled = false; }
  }

  const pf = passField({ onInput: (v) => { s.pass = v; } });
  passInput = pf.querySelector('input');
  root.append(
    h('h2', {}, t('Revelar')),
    h('p', { class: 'lede' }, t('Carga el portador y escribe la misma clave. Si la clave no es la correcta, el resultado es idéntico a que no haya nada: así no se puede confirmar que existe un mensaje.')),
    seg, input, pf, go, out,
  );
  draw();
  return root;
}
