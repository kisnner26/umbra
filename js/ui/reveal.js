import { h, download, formatBytes } from './dom.js';
import { fileDrop, passField, notice, segmented } from './widgets.js';
import { fileToPixels } from './image-io.js';
import { RgbaCarrier } from '../carriers/rgba.js';
import { WavCarrier } from '../carriers/wav.js';
import { extractFromText } from '../carriers/zerowidth.js';
import { extract } from '../core/engine.js';
import { TYPE } from '../core/frame.js';
import { dec } from '../core/bytes.js';

/** Panel "Revelar": lee un mensaje de una imagen, un WAV o un texto. */
export function revealPanel() {
  const s = { mode: 'image', carrier: null, text: '', pass: '', name: '' };
  const root = h('section', { class: 'panel', 'aria-label': 'Revelar' });
  const input = h('div'), out = h('div', { class: 'result', 'aria-live': 'polite' });
  const go = h('button', { class: 'primary', type: 'button', onClick: run, disabled: true }, 'revelar');

  const seg = segmented([['image', 'imagen'], ['audio', 'audio WAV'], ['text', 'texto']], s.mode, (v) => { s.mode = v; s.carrier = null; out.replaceChildren(); draw(); });

  function draw() {
    input.replaceChildren();
    go.disabled = true;
    if (s.mode === 'text') {
      const ta = h('textarea', { rows: 5, placeholder: 'pega aquí el texto con el mensaje invisible', onInput: () => { s.text = ta.value; go.disabled = !ta.value; } });
      input.append(ta);
      return;
    }
    input.append(fileDrop({
      label: s.name || (s.mode === 'image' ? 'suelta la imagen (PNG)' : 'suelta el WAV'),
      accept: s.mode === 'image' ? 'image/*' : 'audio/wav,.wav',
      onFile: async (f) => {
        try {
          s.name = f.name;
          s.carrier = s.mode === 'image' ? new RgbaCarrier((await fileToPixels(f)).pixels) : new WavCarrier(new Uint8Array(await f.arrayBuffer()));
          go.disabled = false; draw2(f.name);
        } catch (e) { out.replaceChildren(notice('error', e.message)); }
      },
    }));
  }
  const draw2 = (name) => { const l = input.querySelector('.drop span'); if (l) l.textContent = `${name} cargado`; };

  async function run() {
    out.replaceChildren();
    go.textContent = 'buscando…'; go.disabled = true;
    try {
      const r = s.mode === 'text' ? await extractFromText(s.text, s.pass) : await extract(s.carrier, s.pass);
      if (r.type === TYPE.text) {
        out.append(notice('ok', 'mensaje encontrado'), h('pre', { class: 'plain' }, dec.decode(r.data)));
      } else {
        const blob = new Blob([r.data]);
        const isImg = /\.(png|jpe?g|gif|webp|bmp)$/i.test(r.name);
        out.append(
          notice('ok', `archivo encontrado: ${r.name || 'sin nombre'} (${formatBytes(r.data.length)})`),
          isImg && h('img', { class: 'found', src: URL.createObjectURL(new Blob([r.data])), alt: 'imagen encontrada' }),
          h('button', { class: 'primary', type: 'button', onClick: () => download(blob, r.name || 'umbra.bin') }, 'descargar'),
        );
      }
    } catch (e) {
      out.append(notice('error', e.code === 'wrongkey' || e.code === 'nomessage'
        ? 'No se encontró ningún mensaje con esta clave. Puede que la clave sea otra, que el archivo se haya recomprimido (JPG, WhatsApp…) o que no haya nada escondido. Por diseño no se puede distinguir cuál.'
        : e.message));
    } finally { go.textContent = 'revelar'; go.disabled = false; }
  }

  root.append(
    h('h2', {}, 'Revelar'),
    h('p', { class: 'lede' }, 'Carga el portador y escribe la misma clave. Si la clave no es la correcta, el resultado es idéntico a que no haya nada: así no se puede confirmar que existe un mensaje.'),
    seg, input,
    passField({ onInput: (v) => { s.pass = v; } }),
    go, out,
  );
  draw();
  return root;
}
