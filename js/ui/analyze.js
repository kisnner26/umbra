import { h, formatBytes } from './dom.js';
import { fileDrop, notice } from './widgets.js';
import { fileToPixels, pixelsToCanvas } from './image-io.js';
import { bitPlane, pairsChiSquare, rgbValues, lsbNeighbourMap, lsbOnes } from '../analysis/stats.js';
import { t } from '../i18n.js';

/** Panel "Analizar": mira una imagen como lo haria quien busca un mensaje escondido. */
export function analyzePanel() {
  const s = { img: null, orig: null, plane: 0, channel: 0 };
  const root = h('section', { class: 'panel', 'aria-label': t('Analizar') });
  const view = h('div', { class: 'analysis' });

  const planeSel = h('input', { type: 'range', min: 0, max: 7, value: 0, 'aria-label': t('plano de bits'), onInput: () => { s.plane = +planeSel.value; planeLabel.textContent = s.plane === 0 ? t('plano 0 (el menos significativo)') : t('plano {n}', { n: s.plane }); draw(); } });
  const planeLabel = h('small', {}, t('plano 0 (el menos significativo)'));
  const chanSel = h('select', { 'aria-label': t('canal'), onChange: () => { s.channel = chanSel.value === 'rgb' ? 'rgb' : +chanSel.value; draw(); } },
    [['0', t('rojo')], ['1', t('verde')], ['2', t('azul')], ['rgb', t('los tres (RGB)')]].map(([v, text]) => h('option', { value: v }, text)));

  async function load(file) {
    view.replaceChildren(notice('ok', t('analizando…')));
    s.img = { ...(await fileToPixels(file)), name: file.name, size: file.size };
    draw();
  }

  async function loadOriginal(file) {
    s.orig = { ...(await fileToPixels(file)), name: file.name };
    draw();
  }

  /** compara con el original: la unica forma segura de ver un LSB matching, que no deja rastro estadistico simple. */
  function comparison() {
    if (!s.orig) return null;
    const a = s.img, b = s.orig;
    if (a.width !== b.width || a.height !== b.height) return notice('error', t('el original tiene otro tamaño: no se pueden comparar píxel a píxel.'));
    const diff = new Uint8ClampedArray(a.pixels.length);
    let changed = 0, ones = 0, bigger = 0;
    for (let i = 0; i < a.pixels.length; i += 4) {
      let any = false;
      for (let c = 0; c < 3; c++) {
        const d = Math.abs(a.pixels[i + c] - b.pixels[i + c]);
        if (d) { any = true; d === 1 ? ones++ : bigger++; }
      }
      if (any) changed++;
      diff[i] = diff[i + 1] = diff[i + 2] = any ? 255 : 0; diff[i + 3] = 255;
    }
    const total = a.pixels.length / 4;
    return h('div', {},
      h('figure', {}, pixelsToCanvas(diff, a.width, a.height), h('figcaption', {}, t('diferencias con el original (blanco = cambió): {changed} de {total} píxeles ({pct} %)', { changed, total, pct: ((changed / total) * 100).toFixed(2) }))),
      h('p', { class: 'meta' }, bigger === 0 && ones > 0 ? t('todos los cambios son de ±1: es la firma de un LSB ({n} canales tocados).', { n: ones }) : t('cambios de ±1: {ones} · mayores: {bigger}', { ones, bigger })),
    );
  }

  function draw() {
    if (!s.img) return;
    const { width, height, pixels } = s.img;
    const chi = pairsChiSquare(rgbValues(pixels));
    const ones = lsbOnes(rgbValues(pixels));
    const map = lsbNeighbourMap(pixels, width, height, 16, 0);
    const finite = map.rate.filter(Number.isFinite);
    const noisy = finite.filter((r) => r < 0.56).length / Math.max(1, finite.length);

    const heat = document.createElement('canvas');
    heat.width = map.bx; heat.height = map.by;
    const hc = heat.getContext('2d');
    map.rate.forEach((r, i) => { const k = Math.max(0, Math.min(1, (r - 0.5) / 0.5)); hc.fillStyle = `rgb(${Math.round(30 + 200 * (1 - k))},${Math.round(30 + 170 * k)},60)`; hc.fillRect(i % map.bx, Math.floor(i / map.bx), 1, 1); });
    heat.className = 'heat';

    view.replaceChildren(
      h('p', { class: 'meta' }, `${s.img.name} · ${width}×${height} · ${formatBytes(s.img.size)}`),
      h('div', { class: 'pair' },
        h('figure', {}, pixelsToCanvas(bitPlane(pixels, s.plane, s.channel), width, height), h('figcaption', {}, t('plano de bits {n}', { n: s.plane }))),
        h('figure', {}, heat, h('figcaption', {}, t('estructura local del LSB por bloques (verde = ordenado, rojo = parece ruido)'))),
      ),
      h('table', { class: 'stats' },
        h('tr', {}, h('th', {}, t('proporción de unos en el LSB')), h('td', {}, `${(ones * 100).toFixed(2)} %`)),
        h('tr', {}, h('th', {}, t('bloques con LSB parecido a ruido')), h('td', {}, `${(noisy * 100).toFixed(0)} %`)),
        h('tr', {}, h('th', {}, t('chi-cuadrado de pares (p)')), h('td', {}, Number.isNaN(chi.p) ? t('pocos datos') : chi.p < 0.001 ? '< 0.001' : chi.p.toFixed(3))),
      ),
      comparison(),
      h('ul', { class: 'reading' },
        h('li', {}, t('Bloques con LSB parecido a ruido: en una imagen limpia o sintética el LSB conserva estructura y un bloque casi aleatorio delata datos. Una foto de cámara ya trae ruido de sensor en el LSB, así que ahí este indicador no distingue nada.')),
        h('li', {}, t('Chi-cuadrado de pares: cerca de 1 sugiere que se sustituyeron los LSB. umbra usa LSB matching (±1), que no lo dispara: aquí importa el mapa de estructura, no este número.')),
        h('li', {}, t('Un plano de bits que parece ruido uniforme en toda la imagen, en una imagen que no es ruido, es la señal clásica.')),
      ),
    );
  }

  root.append(
    h('h2', {}, t('Analizar')),
    h('p', { class: 'lede' }, t('Mira una imagen como lo haría quien busca algo escondido, o comprueba lo que deja tu propia herramienta.')),
    fileDrop({ label: t('suelta la imagen sospechosa'), accept: 'image/*', onFile: load }),
    fileDrop({ label: t('opcional: suelta también el original para compararlos píxel a píxel'), accept: 'image/*', onFile: loadOriginal }),
    h('div', { class: 'controls' }, planeSel, planeLabel, chanSel),
    view,
  );
  return root;
}
