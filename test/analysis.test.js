import test from 'node:test';
import assert from 'node:assert/strict';
import { gammaQ, chiSquarePValue, pairsChiSquare, rgbValues, lsbOnes, lsbNeighbourMap, histogram, bitPlane } from '../js/analysis/stats.js';
import { Prng } from '../js/core/prng.js';
import { RgbaCarrier } from '../js/carriers/rgba.js';
import { embed } from '../js/core/engine.js';
import { TYPE } from '../js/core/frame.js';

const near = (a, b, tol) => assert.ok(Math.abs(a - b) <= tol, `${a} vs ${b}`);

test('chi-cuadrado: valores de tabla conocidos', () => {
  near(chiSquarePValue(3.841, 1), 0.05, 0.001);
  near(chiSquarePValue(5.991, 2), 0.05, 0.001);
  near(chiSquarePValue(18.307, 10), 0.05, 0.001);
  near(chiSquarePValue(124.342, 100), 0.05, 0.001);
  near(chiSquarePValue(0, 5), 1, 1e-12);
  near(chiSquarePValue(1000, 10), 0, 1e-12);
});

test('gammaQ: caso analitico Q(1, x) = e^-x y Q(0.5, x) = erfc(sqrt(x))', () => {
  for (const x of [0.1, 1, 2.5, 7]) near(gammaQ(1, x), Math.exp(-x), 1e-10);
  near(gammaQ(0.5, 1), 0.15729920705, 1e-8);   // erfc(1)
});

/** imagen "natural": gradiente suave con ruido pequeño, para que el histograma no este plano. */
function natural(w, h) {
  const rng = new Prng(new Uint8Array(16).fill(4));
  const px = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4;
    const base = 40 + Math.round(90 * Math.exp(-(((x - w / 2) / (w / 3)) ** 2 + ((y - h / 2) / (h / 3)) ** 2)) + rng.below(3));
    px[i] = base; px[i + 1] = Math.min(255, base + 20 + (x >> 4)); px[i + 2] = base + (y >> 4) % 9; px[i + 3] = 255;
  }
  return px;
}

test('chi-cuadrado de pares: una imagen limpia sale sin igualar y la sustitucion de LSB completa se dispara', () => {
  const clean = natural(256, 256);
  const before = pairsChiSquare(rgbValues(clean));
  assert.ok(before.p < 0.01, `limpia p=${before.p}`);
  const rng = new Prng(new Uint8Array(16).fill(8));
  const replaced = Uint8ClampedArray.from(clean);
  for (let i = 0; i < replaced.length; i++) if (i % 4 !== 3) replaced[i] = (replaced[i] & 0xfe) | (rng.u32() & 1);   // sustitucion, no matching
  const after = pairsChiSquare(rgbValues(replaced));
  assert.ok(after.p > 0.5, `sustituida p=${after.p}`);
});

test('LSB matching (lo que usa umbra) no dispara el chi-cuadrado de pares: es una limitacion documentada de ese ataque', async () => {
  const px = natural(128, 128);
  const c = new RgbaCarrier(px);
  await embed(c, { type: TYPE.file, data: Uint8Array.from({ length: 4000 }, (_, i) => (i * 97 + (i >> 3)) & 255) }, 'k', { iterations: 1000 });
  assert.ok(pairsChiSquare(rgbValues(px)).p < 0.05);
});

test('chi-cuadrado: pocos datos devuelve NaN en vez de inventar', () => {
  assert.ok(Number.isNaN(pairsChiSquare(new Uint8Array([1, 2, 3])).p));
});

test('lsbOnes cuenta la proporcion de unos', () => {
  assert.equal(lsbOnes([1, 3, 5, 7]), 1);
  assert.equal(lsbOnes([0, 2, 4]), 0);
  assert.equal(lsbOnes([1, 2, 3, 4]), 0.5);
  assert.ok(Number.isNaN(lsbOnes([])));
});

test('mapa de vecinos: estructura en la foto, ruido (0.5) donde hay datos incrustados', async () => {
  const w = 128, h = 128;
  const px = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < px.length; i += 4) { const v = (((i / 4) % w) >> 3) * 8; px[i] = px[i + 1] = px[i + 2] = v; px[i + 3] = 255; }   // bandas: LSB igual entre vecinos
  const before = lsbNeighbourMap(px, w, h, 16);
  assert.ok(before.rate.every((r) => r > 0.9), `antes: ${before.rate.slice(0, 4)}`);
  const r = new Prng(new Uint8Array(16).fill(2));
  await embed(new RgbaCarrier(px), { type: TYPE.file, data: Uint8Array.from({ length: 4500 }, () => r.below(256)) }, 'k', { iterations: 1000 });
  const after = lsbNeighbourMap(px, w, h, 16);
  const avg = after.rate.reduce((a, b) => a + b, 0) / after.rate.length;
  assert.ok(avg < 0.8 && avg > 0.4, `despues: ${avg}`);
  assert.equal(before.bx, 8); assert.equal(before.by, 8);
});

test('histograma y plano de bits', () => {
  assert.equal(histogram([1, 1, 2, 255])[1], 2);
  const px = Uint8ClampedArray.from([5, 0, 255, 255, 4, 1, 0, 255]);
  assert.deepEqual([...bitPlane(px, 0, 0)], [255, 255, 255, 255, 0, 0, 0, 255]);   // R: 5 -> 1, 4 -> 0
  assert.deepEqual([...bitPlane(px, 0, 1)], [0, 0, 0, 255, 255, 255, 255, 255]);   // G: 0 -> 0, 1 -> 1
  assert.deepEqual([...bitPlane(px, 2, 0)], [255, 255, 255, 255, 255, 255, 255, 255]);   // bit 2 de 5 y de 4
  assert.deepEqual([...bitPlane(px, 0, 'rgb')].slice(0, 4), [255, 0, 255, 255]);   // 5 -> 1, 0 -> 0, 255 -> 1
});
