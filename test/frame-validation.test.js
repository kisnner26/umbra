import test from 'node:test';
import assert from 'node:assert/strict';
import { packPayload, unpackPayload, TYPE } from '../js/core/frame.js';
import { UmbraError } from '../js/core/errors.js';

const formatError = (error) => error instanceof UmbraError && error.code === 'format';

test('carga: rechaza tipos desconocidos antes de codificar', async () => {
  for (const type of [3, 255, -1, 0.5, undefined]) {
    await assert.rejects(packPayload({ type, data: new Uint8Array() }), formatError);
  }
});

test('carga: rechaza tipos y banderas desconocidos al leer', async () => {
  for (const type of [3, 255]) {
    await assert.rejects(unpackPayload(Uint8Array.of(1, 0, type, 0)), formatError);
  }
  for (const flags of [2, 3, 128, 255]) {
    await assert.rejects(unpackPayload(Uint8Array.of(1, flags, TYPE.text, 0)), formatError);
  }
});

test('carga: un nombre con utf8 inválido produce un error de formato', async () => {
  for (const name of [Uint8Array.of(0xff), Uint8Array.of(0xc3), Uint8Array.of(0xc0, 0x80)]) {
    const payload = Uint8Array.of(1, 0, TYPE.file, name.length, ...name);
    await assert.rejects(unpackPayload(payload), formatError);
  }
});

test('carga: mantiene los tres tipos y los nombres unicode válidos', async () => {
  for (const type of Object.values(TYPE)) {
    const payload = { type, name: 'señal.bin', data: Uint8Array.of(0, 255, 1) };
    assert.deepEqual(await unpackPayload(await packPayload(payload)), payload);
  }
});
