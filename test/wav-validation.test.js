import test from 'node:test';
import assert from 'node:assert/strict';
import { parseWav, makeWav } from '../js/carriers/wav.js';
import { UmbraError } from '../js/core/errors.js';

const formatError = (error) => error instanceof UmbraError && error.code === 'format';

function chunks(entries) {
  const length = 12 + entries.reduce((n, [, data]) => n + 8 + data.length + (data.length & 1), 0);
  const out = new Uint8Array(length);
  const view = new DataView(out.buffer);
  const tag = (offset, text) => [...text].forEach((c, i) => { out[offset + i] = c.charCodeAt(0); });
  tag(0, 'RIFF'); tag(8, 'WAVE'); view.setUint32(4, length - 8, true);
  let offset = 12;
  for (const [name, data] of entries) {
    tag(offset, name); view.setUint32(offset + 4, data.length, true);
    out.set(data, offset + 8); offset += 8 + data.length + (data.length & 1);
  }
  return out;
}

test('wav: los bloques fmt cortos producen un error de formato', () => {
  for (const size of [0, 2, 15]) {
    const wav = chunks([['JUNK', new Uint8Array(16)], ['fmt ', new Uint8Array(size)]]);
    assert.throws(() => parseWav(wav), formatError);
  }
});

test('wav: rechaza tamaños de bloque y riff superiores al archivo', () => {
  const wav = makeWav([1, 2, 3]);
  new DataView(wav.buffer).setUint32(40, 100, true);
  assert.throws(() => parseWav(wav), formatError);
  const truncated = makeWav([1, 2, 3]).slice(0, -2);
  assert.throws(() => parseWav(truncated), formatError);
});

test('wav: no usa bloques fuera del tamaño declarado de riff', () => {
  const wav = makeWav([1, 2, 3]);
  new DataView(wav.buffer).setUint32(4, 28, true);
  assert.throws(() => parseWav(wav), formatError);
});

test('wav: conserva bloques desconocidos impares y vistas con desplazamiento', () => {
  const original = makeWav([1, 2, 3]);
  const wav = chunks([['JUNK', new Uint8Array([7])], ['fmt ', original.slice(20, 36)], ['data', original.slice(44)]]);
  const buffer = new Uint8Array(wav.length + 10);
  buffer.set(wav, 5);
  const view = buffer.subarray(5, 5 + wav.length);
  const { start, end } = parseWav(view);
  assert.deepEqual(view.slice(start, end), original.slice(44));
  assert.deepEqual(parseWav(makeWav([])), { start: 44, end: 44 });
});
