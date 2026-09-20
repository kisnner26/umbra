import test from 'node:test';
import assert from 'node:assert/strict';
import { embed, extract, capacityBytes, SlotPermutation } from '../js/core/engine.js';
import { Prng } from '../js/core/prng.js';
import { RgbaCarrier } from '../js/carriers/rgba.js';
import { TYPE } from '../js/core/frame.js';
import { UmbraError } from '../js/core/errors.js';
import { enc, dec } from '../js/core/bytes.js';

const IT = { iterations: 1000 };   // PBKDF2 real es lento a proposito; en pruebas basta con poco

/** imagen sintetica con textura (no plana), determinista. */
function image(w, h, seed = 7) {
  const rng = new Prng(new Uint8Array(16).fill(seed));
  const px = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < px.length; i += 4) {
    px[i] = rng.below(256); px[i + 1] = rng.below(256); px[i + 2] = rng.below(256); px[i + 3] = 255;
  }
  return px;
}

const text = (s) => ({ type: TYPE.text, data: enc.encode(s) });
/** bytes incompresibles y deterministas. */
const noise = (n, seed = 5) => { const r = new Prng(new Uint8Array(16).fill(seed)); return Uint8Array.from({ length: n }, () => r.below(256)); };

test('ida y vuelta de un texto con clave', async () => {
  const c = new RgbaCarrier(image(64, 64));
  await embed(c, text('hola, mundo'), 'clave', IT);
  const out = await extract(c, 'clave', IT);
  assert.equal(out.type, TYPE.text);
  assert.equal(dec.decode(out.data), 'hola, mundo');
});

test('ida y vuelta sin clave y con archivo binario con nombre', async () => {
  const c = new RgbaCarrier(image(64, 64));
  const data = Uint8Array.from({ length: 300 }, (_, i) => (i * 37) & 255);
  await embed(c, { type: TYPE.file, name: 'foto ñ.png', data }, '', IT);
  const out = await extract(c, '', IT);
  assert.equal(out.type, TYPE.file); assert.equal(out.name, 'foto ñ.png');
  assert.deepEqual(out.data, data);
});

test('una clave incorrecta no revela ni distingue el mensaje', async () => {
  const c = new RgbaCarrier(image(64, 64));
  await embed(c, text('secreto'), 'buena', IT);
  await assert.rejects(extract(c, 'mala', IT), (e) => e instanceof UmbraError && ['wrongkey', 'nomessage'].includes(e.code));
  await assert.rejects(extract(c, '', IT), UmbraError);
});

test('una imagen sin mensaje no devuelve nada', async () => {
  const c = new RgbaCarrier(image(64, 64));
  await assert.rejects(extract(c, 'x', IT), UmbraError);
  await assert.rejects(extract(c, '', IT), UmbraError);
});

test('cada muestra cambia como mucho en 1 y solo se tocan canales RGB', async () => {
  const before = image(64, 64);
  const c = new RgbaCarrier(Uint8ClampedArray.from(before));
  await embed(c, text('x'.repeat(200)), 'k', IT);
  let changed = 0;
  for (let i = 0; i < before.length; i++) {
    const d = Math.abs(c.pixels[i] - before[i]);
    assert.ok(d <= 1, `muestra ${i} cambio ${d}`);
    if (i % 4 === 3) assert.equal(d, 0, 'el alfa no se toca');
    if (d) changed++;
  }
  assert.ok(changed > 200 && changed < 1200, `cambiaron ${changed}`);   // ~ la mitad de los bits usados (~230 bytes = ~1800 bits)
});

test('LSB matching: no fuerza el bit, asi que la paridad de las muestras cambia en las dos direcciones', async () => {
  const before = image(64, 64);
  const c = new RgbaCarrier(Uint8ClampedArray.from(before));
  await embed(c, text('y'.repeat(300)), 'k', IT);
  let up = 0, down = 0;
  for (let i = 0; i < before.length; i++) { const d = c.pixels[i] - before[i]; if (d > 0) up++; if (d < 0) down++; }
  assert.ok(up > 100 && down > 100, `up=${up} down=${down}`);
});

test('los extremos 0 y 255 no se salen de rango', async () => {
  const px = new Uint8ClampedArray(64 * 64 * 4);
  for (let i = 0; i < px.length; i += 4) { px[i] = 0; px[i + 1] = 255; px[i + 2] = 255; px[i + 3] = 255; }
  const c = new RgbaCarrier(px);
  await embed(c, text('extremos'), 'k', IT);
  assert.equal(dec.decode((await extract(c, 'k', IT)).data), 'extremos');
});

test('el mismo mensaje con dos claves toca posiciones distintas', async () => {
  const base = image(64, 64);
  const a = new RgbaCarrier(Uint8ClampedArray.from(base)), b = new RgbaCarrier(Uint8ClampedArray.from(base));
  await embed(a, text('igual'), 'uno', IT);
  await embed(b, text('igual'), 'dos', IT);
  const diffA = new Set(), diffB = new Set();
  for (let i = 0; i < base.length; i++) { if (a.pixels[i] !== base[i]) diffA.add(i); if (b.pixels[i] !== base[i]) diffB.add(i); }
  const shared = [...diffA].filter((i) => diffB.has(i)).length;
  assert.ok(shared < Math.min(diffA.size, diffB.size) / 2, `comparten ${shared}`);
});

test('el mensaje esta repartido por toda la imagen, no en el principio', async () => {
  const before = image(128, 128);
  const c = new RgbaCarrier(Uint8ClampedArray.from(before));
  await embed(c, { type: TYPE.file, data: noise(400) }, 'k', IT);
  const quarters = [0, 0, 0, 0];
  for (let i = 0; i < before.length; i++) if (c.pixels[i] !== before[i]) quarters[Math.min(3, Math.floor((i / before.length) * 4))]++;
  for (const q of quarters) assert.ok(q > 200, `cuartos ${quarters}`);
});

test('error de capacidad con las cifras', async () => {
  const c = new RgbaCarrier(image(8, 8));      // 192 ranuras = 24 bytes
  await assert.rejects(embed(c, text('a'.repeat(100)), 'k', IT), (e) => e.code === 'capacity' && e.detail.need > e.detail.have);
});

test('cabe justo lo que dice capacityBytes', async () => {
  const c = new RgbaCarrier(image(32, 32));
  const cap = capacityBytes(c);
  const data = noise(cap);   // incompresible: no se aprovecha la compresion
  await embed(c, { type: TYPE.file, data }, 'k', IT);
  assert.deepEqual((await extract(c, 'k', IT)).data, data);
  const c2 = new RgbaCarrier(image(32, 32));
  await assert.rejects(embed(c2, { type: TYPE.file, data: noise(cap + 1, 6) }, 'k', IT), (e) => e.code === 'capacity');
});

test('un texto repetitivo se comprime y cabe donde sin comprimir no cabria', async () => {
  const c = new RgbaCarrier(image(16, 16));    // 768 ranuras = 96 bytes
  const big = 'ab'.repeat(500);
  await embed(c, text(big), 'k', IT);
  assert.equal(dec.decode((await extract(c, 'k', IT)).data), big);
});

test('la permutacion no repite posiciones y cubre todo el rango', () => {
  const p = new SlotPermutation(1000, new Prng(new Uint8Array(16).fill(3)));
  const seen = new Set();
  for (let i = 0; i < 1000; i++) seen.add(p.next());
  assert.equal(seen.size, 1000);
  assert.ok([...seen].every((x) => x >= 0 && x < 1000));
  assert.throws(() => p.next(), RangeError);
});

test('las primeras posiciones no dependen de cuantas se pidan despues', () => {
  const seed = new Uint8Array(16).fill(9);
  const a = new SlotPermutation(10_000, new Prng(seed)), b = new SlotPermutation(10_000, new Prng(seed));
  const first = Array.from({ length: 50 }, () => a.next());
  for (let i = 0; i < 5000; i++) b.next();
  const b2 = new SlotPermutation(10_000, new Prng(seed));
  assert.deepEqual(Array.from({ length: 50 }, () => b2.next()), first);
});

test('prng: below es uniforme y respeta el rango', () => {
  const r = new Prng(new Uint8Array(16).fill(1));
  const counts = new Array(6).fill(0);
  for (let i = 0; i < 60_000; i++) counts[r.below(6)]++;
  for (const c of counts) assert.ok(c > 9000 && c < 11000, counts.join());
  assert.equal(r.below(1), 0);
  assert.throws(() => r.below(0), RangeError);
});

test('las semillas de posiciones y de ruido son distintas entre si y dependen de la clave', async () => {
  const { slotSeeds } = await import('../js/core/seal.js');
  const a = await slotSeeds('uno', 1000), b = await slotSeeds('uno', 1000), c = await slotSeeds('dos', 1000);
  assert.notDeepEqual(a.positions, a.noise, 'ruido y posiciones no pueden ser la misma secuencia');
  assert.deepEqual(a, b);
  assert.notDeepEqual(a.positions, c.positions);
  assert.equal(a.positions.length, 16); assert.equal(a.noise.length, 16);
});

test('prng.below no tiene sesgo de modulo cuando n no divide 2^32', () => {
  const r = new Prng(new Uint8Array(16).fill(5));
  const n = 3 * 2 ** 30;                 // 2^32 % n = 2^30: sin rechazo, el primer tercio saldria el doble de veces
  let low = 0;
  const N = 30_000;
  for (let i = 0; i < N; i++) if (r.below(n) < 2 ** 30) low++;
  assert.ok(Math.abs(low / N - 1 / 3) < 0.02, `fraccion baja ${low / N}`);
});
