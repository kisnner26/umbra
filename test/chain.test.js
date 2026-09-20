import test from 'node:test';
import assert from 'node:assert/strict';
import { buildChain, solveChain, solutionSheet } from '../js/puzzle/chain.js';
import { packBundle, unpackBundle } from '../js/core/bundle.js';
import { UmbraError } from '../js/core/errors.js';
import { Prng } from '../js/core/prng.js';
import { toRunes, fromRunes } from '../js/ciphers/classic.js';
import { enc } from '../js/core/bytes.js';

const IT = { iterations: 500 };

/** "PNG" de mentira para probar sin navegador: 8 bytes de cabecera con el tamaño y despues los pixeles en bruto. */
const io = {
  makeCarrier(level, index, needed) {
    const px = Math.ceil((needed * 8) / 3) + 200;            // ranuras necesarias -> pixeles
    const width = Math.ceil(Math.sqrt(px)), height = width;
    const rng = new Prng(new Uint8Array(16).fill(index + 1));
    const pixels = new Uint8ClampedArray(width * height * 4);
    for (let i = 0; i < pixels.length; i += 4) { pixels[i] = rng.below(256); pixels[i + 1] = rng.below(256); pixels[i + 2] = rng.below(256); pixels[i + 3] = 255; }
    return { pixels, width, height };
  },
  async encodeImage({ pixels, width, height }) {
    const out = new Uint8Array(8 + pixels.length);
    new DataView(out.buffer).setUint32(0, width); new DataView(out.buffer).setUint32(4, height);
    out.set(pixels, 8);
    return out;
  },
  async decodeImage(bytes) {
    return { width: new DataView(bytes.buffer, bytes.byteOffset).getUint32(0), pixels: Uint8ClampedArray.from(bytes.subarray(8)) };
  },
};

const levels = [
  { pass: 'primus', message: 'the second key is divinity', cipher: { id: 'runes' }, clue: 'ᚠᚢᚦ' },
  { pass: 'divinity', message: 'the third key is 212', cipher: { id: 'caesar', key: 3 } },
  { pass: '212', message: 'you found the end' },
];

test('paquete: ida y vuelta con texto y varios archivos, tambien vacios', () => {
  const b = { text: 'hola ñ 🌻', files: [{ name: 'a.png', data: Uint8Array.of(1, 2, 3) }, { name: 'b', data: new Uint8Array(0) }] };
  assert.deepEqual(unpackBundle(packBundle(b)), b);
  assert.deepEqual(unpackBundle(packBundle({})), { text: '', files: [] });
});

test('paquete: rechaza lo truncado, con basura al final o sin la marca', () => {
  const ok = packBundle({ text: 'x', files: [{ name: 'n', data: Uint8Array.of(9, 9) }] });
  for (let cut = 1; cut < ok.length; cut++) assert.throws(() => unpackBundle(ok.slice(0, cut)), UmbraError, `cortado en ${cut}`);
  assert.throws(() => unpackBundle(Uint8Array.from([...ok, 0])), UmbraError);
  assert.throws(() => unpackBundle(new Uint8Array(20)), UmbraError);
  assert.throws(() => packBundle({ files: [{ name: 'a'.repeat(256), data: new Uint8Array(1) }] }), UmbraError);
});

test('un reto de tres niveles se construye y se resuelve nivel a nivel', async () => {
  const { first, solution } = await buildChain(levels, io, IT);
  const steps = await solveChain(first, ['primus', 'divinity', '212'], io, IT);
  assert.equal(steps.length, 3);
  assert.equal(fromRunes(steps[0].text), 'THE SECOND CEY IS DIUINITY');        // el jugador ve runas: K y V no tienen runa propia (como en el original) y hay que deducirlas
  assert.match(steps[1].text, /^wkh wklug nhb lv 212$/);                        // cesar +3 (los números no cambian)
  assert.equal(steps[2].text, 'you found the end');
  assert.equal(steps[0].files.length, 1); assert.equal(steps[0].files[0].name, 'nivel-2.png');
  assert.equal(steps[2].files.length, 0);
  assert.equal(solution.length, 3); assert.equal(solution[0].level, 1);
});

test('cada nivel exige su clave: una clave de otro nivel no abre nada', async () => {
  const { first } = await buildChain(levels, io, IT);
  await assert.rejects(solveChain(first, ['divinity'], io, IT), UmbraError);
  await assert.rejects(solveChain(first, ['primus', 'primus'], io, IT), UmbraError);
  await assert.rejects(solveChain(first, ['primus', 'divinity', 'nope'], io, IT), UmbraError);
});

test('los portadores crecen hacia fuera para que quepa la imagen del nivel siguiente', async () => {
  const { images } = await buildChain(levels, io, IT);
  assert.ok(images[0].length > images[1].length && images[1].length > images[2].length, images.map((i) => i.length).join(' > '));
});

test('un nivel solo tambien es un reto valido', async () => {
  const { first } = await buildChain([{ pass: 'k', message: 'solo uno' }], io, IT);
  assert.equal((await solveChain(first, ['k'], io, IT))[0].text, 'solo uno');
});

test('validaciones: sin niveles, sin clave o con un portador demasiado pequeño', async () => {
  await assert.rejects(buildChain([], io, IT), (e) => e instanceof UmbraError);
  await assert.rejects(buildChain([{ pass: '', message: 'x' }], io, IT), /clave/);
  const tiny = { ...io, makeCarrier: () => ({ pixels: new Uint8ClampedArray(16 * 4).fill(255), width: 4, height: 4 }) };
  await assert.rejects(buildChain(levels, tiny, IT), (e) => e.code === 'capacity' && Number.isInteger(e.detail.level) && e.detail.need > e.detail.have, 'el error dice que nivel no cabe');
});

test('la ficha para el creador lista claves, cifrados y mensajes', async () => {
  const { solution } = await buildChain(levels, io, IT);
  const sheet = solutionSheet(solution, 'mi reto');
  for (const needle of ['# mi reto', '## nivel 1', 'primus', 'Runas (Gematria Primus)', 'César (clave: 3)', 'the second key is divinity', toRunes('the second key is divinity'), 'ᚠᚢᚦ', '## nivel 3']) {
    assert.ok(sheet.includes(needle), `falta ${needle}`);
  }
});

test('los tipos de carga son parte del formato: no pueden cambiar de valor', async () => {
  const { TYPE } = await import('../js/core/frame.js');
  assert.deepEqual(TYPE, { text: 0, file: 1, bundle: 2 });
});
