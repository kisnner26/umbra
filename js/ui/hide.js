import { h, download, formatBytes } from './dom.js';
import { fileDrop, passField, meter, notice, segmented } from './widgets.js';
import { fileToPixels, pixelsToCanvas, canvasToPng, generateCover } from './image-io.js';
import { RgbaCarrier } from '../carriers/rgba.js';
import { WavCarrier, makeWav } from '../carriers/wav.js';
import { hideInText, clean } from '../carriers/zerowidth.js';
import { embed, capacityBytes } from '../core/engine.js';
import { TYPE } from '../core/frame.js';
import { enc } from '../core/bytes.js';

/** Panel "Ocultar": elige portador (imagen, audio o texto), carga util y clave, y devuelve el portador con el mensaje dentro. */
export function hidePanel() {
  const s = { mode: 'image', cover: null, payloadMode: 'text', text: '', file: null, pass: '', busy: false };
  const root = h('section', { class: 'panel', 'aria-label': 'Ocultar' });
  const coverBox = h('div'), payloadBox = h('div'), result = h('div', { class: 'result', 'aria-live': 'polite' });
  const cap = meter();
  const go = h('button', { class: 'primary', type: 'button', onClick: run }, 'ocultar');

  const modeSeg = segmented([['image', 'imagen PNG'], ['audio', 'audio WAV'], ['text', 'texto']], s.mode, (v) => { s.mode = v; s.cover = null; result.replaceChildren(); drawCover(); refresh(); });
  const payloadSeg = segmented([['text', 'mensaje'], ['file', 'archivo']], s.payloadMode, (v) => { s.payloadMode = v; drawPayload(); refresh(); });

  function drawCover() {
    coverBox.replaceChildren();
    if (s.mode === 'image') {
      coverBox.append(
        fileDrop({ label: 'suelta una imagen (PNG o BMP conviene; un JPG ya perdio datos)', accept: 'image/*', onFile: async (f) => { s.cover = { kind: 'image', ...(await fileToPixels(f)), name: f.name }; showImage(); refresh(); } }),
        h('button', { class: 'ghost', type: 'button', onClick: () => { const c = generateCover(512, Date.now()); const d = c.getContext('2d').getImageData(0, 0, 512, 512); s.cover = { kind: 'image', width: 512, height: 512, pixels: d.data, name: 'ejemplo.png' }; showImage(); refresh(); } }, 'generar una imagen de ejemplo'),
        h('div', { class: 'preview', id: 'cover-preview' }),
      );
    } else if (s.mode === 'audio') {
      coverBox.append(
        fileDrop({ label: 'suelta un WAV (PCM 16 bits)', accept: 'audio/wav,.wav', onFile: async (f) => { try { const bytes = new Uint8Array(await f.arrayBuffer()); new WavCarrier(bytes); s.cover = { kind: 'audio', bytes, name: f.name }; refresh(); } catch (e) { result.replaceChildren(notice('error', e.message)); } } }),
        h('button', { class: 'ghost', type: 'button', onClick: () => { const n = 44100 * 6; const samples = Array.from({ length: n }, (_, i) => Math.round(9000 * Math.sin(i / 14) * Math.sin(i / 9000) + (Math.random() * 60 - 30))); s.cover = { kind: 'audio', bytes: makeWav(samples), name: 'ejemplo.wav' }; refresh(); } }, 'generar un audio de ejemplo'),
      );
    } else {
      const ta = h('textarea', { rows: 4, placeholder: 'texto de portada: lo que se verá', onInput: () => { s.cover = { kind: 'text', text: ta.value }; refresh(); } });
      coverBox.append(ta);
    }
  }

  function showImage() {
    const box = coverBox.querySelector('#cover-preview');
    if (!box || !s.cover) return;
    box.replaceChildren(pixelsToCanvas(s.cover.pixels, s.cover.width, s.cover.height), h('small', {}, `${s.cover.name} · ${s.cover.width}×${s.cover.height}${s.cover.flattened ? ' · la transparencia se aplanó sobre negro' : ''}`));
  }

  function drawPayload() {
    payloadBox.replaceChildren();
    if (s.payloadMode === 'text') {
      const ta = h('textarea', { rows: 5, placeholder: 'lo que quieres esconder', value: s.text, onInput: () => { s.text = ta.value; refresh(); } });
      payloadBox.append(ta);
    } else {
      payloadBox.append(fileDrop({ label: s.file ? `${s.file.name} (${formatBytes(s.file.size)})` : 'elige el archivo que quieres esconder (otra imagen, un zip…)', accept: '*/*', onFile: (f) => { s.file = f; drawPayload(); refresh(); } }));
    }
  }

  const payloadSize = () => (s.payloadMode === 'text' ? enc.encode(s.text).length : s.file?.size ?? 0);

  function refresh() {
    let capBytes = 0;
    if (s.cover?.kind === 'image') capBytes = capacityBytes(new RgbaCarrier(s.cover.pixels), { encrypted: !!s.pass });
    if (s.cover?.kind === 'audio') capBytes = capacityBytes(new WavCarrier(s.cover.bytes), { encrypted: !!s.pass });
    if (s.cover?.kind === 'text') capBytes = Number.POSITIVE_INFINITY;
    cap.style.display = s.cover?.kind === 'text' ? 'none' : '';
    if (Number.isFinite(capBytes)) cap.set(payloadSize(), capBytes, '(sin contar la compresión)');
    go.disabled = s.busy || !s.cover || !payloadSize() || (s.cover.kind === 'text' && !clean(s.cover.text ?? '').length);
  }

  async function payload() {
    if (s.payloadMode === 'text') return { type: TYPE.text, data: enc.encode(s.text) };
    return { type: TYPE.file, name: s.file.name, data: new Uint8Array(await s.file.arrayBuffer()) };
  }

  async function run() {
    s.busy = true; go.textContent = 'ocultando…'; refresh(); result.replaceChildren();
    try {
      const p = await payload();
      if (s.cover.kind === 'image') {
        const px = Uint8ClampedArray.from(s.cover.pixels);
        const info = await embed(new RgbaCarrier(px), p, s.pass);
        let changed = 0;
        const diff = new Uint8ClampedArray(px.length);
        for (let i = 0; i < px.length; i += 4) {
          const c = px[i] !== s.cover.pixels[i] || px[i + 1] !== s.cover.pixels[i + 1] || px[i + 2] !== s.cover.pixels[i + 2];
          if (c) changed++;
          diff[i] = diff[i + 1] = diff[i + 2] = c ? 255 : 0; diff[i + 3] = 255;
        }
        const out = pixelsToCanvas(px, s.cover.width, s.cover.height);
        const png = await canvasToPng(out);
        result.append(
          notice('ok', `listo: ${info.bitsUsed} bits repartidos por la imagen; ${changed} píxeles cambiaron (como mucho ±1 en un canal).`),
          h('div', { class: 'pair' }, figure(out, 'resultado'), figure(pixelsToCanvas(diff, s.cover.width, s.cover.height), 'dónde cambió (blanco = cambió)')),
          h('button', { class: 'primary', type: 'button', onClick: () => download(png, `umbra-${s.cover.name.replace(/\.\w+$/, '')}.png`) }, 'descargar PNG'),
          h('small', {}, 'guárdalo como PNG y no lo pases por WhatsApp, Instagram ni nada que recomprima: un solo píxel distinto y el mensaje se pierde.'),
        );
      } else if (s.cover.kind === 'audio') {
        const bytes = Uint8Array.from(s.cover.bytes);
        const info = await embed(new WavCarrier(bytes), p, s.pass);
        const blob = new Blob([bytes], { type: 'audio/wav' });
        result.append(
          notice('ok', `listo: ${info.bitsUsed} bits repartidos por ${info.slots} muestras.`),
          h('audio', { controls: true, src: URL.createObjectURL(blob) }),
          h('button', { class: 'primary', type: 'button', onClick: () => download(blob, `umbra-${s.cover.name}`) }, 'descargar WAV'),
        );
      } else {
        const text = await hideInText(s.cover.text, p, s.pass);
        const area = h('textarea', { rows: 4, readOnly: true }, text);
        result.append(
          notice('ok', `listo: se añadieron ${text.length - [...clean(s.cover.text)].join('').length} caracteres invisibles. Se ve igual que el original.`),
          area,
          h('button', { class: 'primary', type: 'button', onClick: async (e) => { await navigator.clipboard.writeText(text); e.target.textContent = 'copiado ✓'; } }, 'copiar texto'),
          h('small', {}, 'pégalo donde quieras: los caracteres invisibles viajan con él, salvo en sitios que los limpian.'),
        );
      }
    } catch (e) {
      result.append(notice('error', e.code === 'capacity' ? `no cabe: hacen falta ${formatBytes(Math.ceil(e.detail.need / 8))} y el portador tiene ${formatBytes(Math.floor(e.detail.have / 8))}. Usa un portador mayor o un mensaje más corto.` : e.message));
    } finally {
      s.busy = false; go.textContent = 'ocultar'; refresh();
    }
  }

  const figure = (canvas, cap) => h('figure', {}, canvas, h('figcaption', {}, cap));

  root.append(
    h('h2', {}, 'Ocultar'),
    h('p', { class: 'lede' }, 'Elige dónde esconderlo, escribe la clave y descarga el resultado. Todo ocurre en tu navegador: nada se sube a ningún sitio.'),
    h('h3', {}, '1 · portador'), modeSeg, coverBox,
    h('h3', {}, '2 · qué esconder'), payloadSeg, payloadBox,
    h('h3', {}, '3 · clave'),
    passField({ onInput: (v) => { s.pass = v; refresh(); }, hint: 'Cifra con AES-256-GCM y decide en qué píxeles va cada bit. Sin la clave no se ve nada ni se puede probar si hay mensaje.' }),
    cap, go, result,
  );
  drawCover(); drawPayload(); refresh();
  return root;
}
