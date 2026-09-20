import test from 'node:test';
import assert from 'node:assert/strict';
import { embed, extract } from '../js/core/engine.js';
import { WavCarrier, makeWav, parseWav } from '../js/carriers/wav.js';
import { hideInText, extractFromText, hasHidden, clean } from '../js/carriers/zerowidth.js';
import { TYPE } from '../js/core/frame.js';
import { UmbraError } from '../js/core/errors.js';
import { enc, dec } from '../js/core/bytes.js';

const IT = { iterations: 1000 };
const text = (s) => ({ type: TYPE.text, data: enc.encode(s) });
const tone = (n) => Array.from({ length: n }, (_, i) => Math.round(8000 * Math.sin(i / 9) + ((i * 7919) % 41) - 20));

test('wav: ida y vuelta y la señal casi no cambia', async () => {
  const samples = tone(20_000);
  const wav = makeWav(samples);
  const c = new WavCarrier(wav);
  await embed(c, text('en la onda'), 'k', IT);
  assert.equal(dec.decode((await extract(new WavCarrier(wav), 'k', IT)).data), 'en la onda');
  const v = new DataView(wav.buffer);
  let maxDiff = 0;
  samples.forEach((s, i) => { maxDiff = Math.max(maxDiff, Math.abs(v.getInt16(44 + i * 2, true) - s)); });
  assert.equal(maxDiff, 1);
});

test('wav: valores extremos de 16 bits no se desbordan', async () => {
  const samples = Array.from({ length: 4000 }, (_, i) => (i % 2 ? 32767 : -32768));
  const wav = makeWav(samples);
  await embed(new WavCarrier(wav), text('borde'), 'k', IT);
  assert.equal(dec.decode((await extract(new WavCarrier(wav), 'k', IT)).data), 'borde');
  const v = new DataView(wav.buffer);
  samples.forEach((s, i) => assert.ok(Math.abs(v.getInt16(44 + i * 2, true) - s) <= 1, `muestra ${i} dio un salto (un chasquido audible)`));
});

test('wav: rechaza lo que no es wav pcm de 16 bits y respeta el bloque de datos', () => {
  assert.throws(() => new WavCarrier(new Uint8Array(100)), UmbraError);
  const wav = makeWav(tone(100));
  wav[34] = 8;   // 8 bits
  assert.throws(() => parseWav(wav), UmbraError);
  const ok = parseWav(makeWav(tone(100)));
  assert.equal(ok.start, 44); assert.equal(ok.end, 44 + 200);
});

test('wav: clave incorrecta falla', async () => {
  const wav = makeWav(tone(20_000));
  await embed(new WavCarrier(wav), text('x'), 'a', IT);
  await assert.rejects(extract(new WavCarrier(wav), 'b', IT), UmbraError);
});

test('texto: ida y vuelta, el texto visible no cambia y los invisibles no se ven', async () => {
  const cover = 'El zorro marrón salta sobre el perro perezoso, otra vez.';
  const hidden = await hideInText(cover, text('nos vemos a medianoche'), 'clave', IT);
  assert.ok(hasHidden(hidden));
  assert.equal(clean(hidden), cover);
  assert.equal(dec.decode((await extractFromText(hidden, 'clave', IT)).data), 'nos vemos a medianoche');
});

test('texto: el ZWJ y el ZWNJ legitimos de la portada se conservan', async () => {
  const cover = 'familia 👨‍👩‍👧 y نامه‌ای';
  const hidden = await hideInText(cover, text('sigue'), 'k', IT);
  assert.equal(clean(hidden), cover);
  assert.ok(clean(hidden).includes('\u200d') && clean(hidden).includes('\u200c'));
});

test('texto: sin clave y con emoji y combinados en la portada', async () => {
  const cover = 'hola 👩🏽‍💻 mundo é';
  const hidden = await hideInText(cover, text('ok'), '', IT);
  assert.equal(clean(hidden), cover);
  assert.equal(dec.decode((await extractFromText(hidden, '', IT)).data), 'ok');
});

test('texto: clave incorrecta, texto sin mensaje y mensaje truncado fallan', async () => {
  const hidden = await hideInText('una frase de portada', text('s'), 'a', IT);
  await assert.rejects(extractFromText(hidden, 'b', IT), UmbraError);
  await assert.rejects(extractFromText('texto normal', 'a', IT), UmbraError);
  await assert.rejects(extractFromText(hidden.slice(0, hidden.length - 5), 'a', IT), UmbraError);
});

test('texto: los invisibles que ya traia la portada no se mezclan con el mensaje', async () => {
  const dirty = 'a\u200bb\u2062c\u2060d\u2063e';
  const hidden = await hideInText(dirty, text('limpio'), 'k', IT);
  assert.equal(clean(hidden), 'abcde');
  assert.equal(dec.decode((await extractFromText(hidden, 'k', IT)).data), 'limpio');
});

test('texto: una portada vacia da error de capacidad', async () => {
  await assert.rejects(hideInText('', text('x'), 'k', IT), (e) => e.code === 'capacity');
});
