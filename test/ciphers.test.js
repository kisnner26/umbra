import test from 'node:test';
import assert from 'node:assert/strict';
import { RUNES, toRuneTokens, gematria, runesToLatin } from '../js/ciphers/runes.js';
import * as c from '../js/ciphers/classic.js';
import { ciphers } from '../js/ciphers/index.js';

test('hay 29 runas con primos crecientes y sin repetir', () => {
  assert.equal(RUNES.length, 29);
  const primes = RUNES.map((r) => r[2]);
  assert.deepEqual(primes, [...primes].sort((a, b) => a - b));
  assert.equal(new Set(primes).size, 29);
  assert.equal(primes[0], 2); assert.equal(primes[28], 109);
  for (const p of primes) for (let d = 2; d * d <= p; d++) assert.notEqual(p % d, 0, `${p} no es primo`);
});

test('transliteracion: digrafos, alias y no letras', () => {
  assert.equal(c.toRunes('THE'), 'ᚦᛖ');
  assert.equal(c.toRunes('KING'), 'ᚳᛝ');                 // K -> C, ING -> NG
  assert.equal(c.toRunes('SING'), 'ᛋᛝ');                // ING gana a I + NG solo si va junto: "SING" = S + ING
  assert.equal(c.toRunes('quiz'), 'ᚳᚹᚢᛁᛋ');              // Q -> CW, Z -> S
  assert.equal(c.toRunes('AE oe'), 'ᚫ ᛟ');
  assert.equal(c.toRunes('a-1!'), 'ᚪ-1!');
  assert.equal(c.toRunes('Camión'), 'ᚳᚪᛗᛡᚾ');            // el acento se quita y IO es el digrafo de la runa IA
});

test('ida y vuelta de runas a letras', () => {
  assert.equal(runesToLatin(c.toRunes('the path')), 'THE PATH');
  assert.equal(runesToLatin('ᚦᛖ ᛒᚪᛋ'), 'THE BAS');
});

test('gematria: suma de primos', () => {
  assert.equal(gematria('ᚠ'), 2);
  assert.equal(gematria('ᚠᚢᚦ'), 2 + 3 + 5);
  assert.equal(gematria('ᛠ hola ᚠ'), 109 + 2);   // lo que no es runa no suma
  assert.equal(gematria(''), 0);
});

test('cesar: cifra y descifra, conserva caso y signos', () => {
  assert.equal(c.caesar('Hola, Mundo!', 3), 'Krod, Pxqgr!');
  assert.equal(c.caesar(c.caesar('Hola, Mundo!', 3), -3), 'Hola, Mundo!');
  assert.equal(c.caesar('xyz', 3), 'abc');
  assert.equal(c.caesar('abc', -29), 'xyz');
});

test('atbash es su propia inversa', () => {
  assert.equal(c.atbash('Hello'), 'Svool');
  assert.equal(c.atbash(c.atbash('Hello, World')), 'Hello, World');
});

test('vigenere: vector conocido y la clave solo avanza con letras', () => {
  assert.equal(c.vigenere('ATTACKATDAWN', 'LEMON'), 'LXFOPVEFRNHR');
  assert.equal(c.vigenere('LXFOPVEFRNHR', 'LEMON', true), 'ATTACKATDAWN');
  assert.equal(c.vigenere('attack at dawn', 'lemon'), 'lxfopv ef rnhr');
  assert.throws(() => c.vigenere('a', '123'), /clave/);
});

test('runas: desplazamiento, atbash y vigenere son invertibles y dan la vuelta al alfabeto', () => {
  const r = c.toRunes('the path of the seeker');
  assert.equal(c.runeShift(c.runeShift(r, 5), -5), r);
  assert.equal(c.runeShift('ᛠ', 1), 'ᚠ');            // la ultima da la vuelta a la primera
  assert.equal(c.runeShift('ᚠ', -1), 'ᛠ');
  assert.equal(c.runeAtbash('ᚠ'), 'ᛠ'); assert.equal(c.runeAtbash(c.runeAtbash(r)), r);
  assert.equal(c.runeVigenere(c.runeVigenere(r, 'DIVINITY'), 'DIVINITY', true), r);
  assert.notEqual(c.runeVigenere(r, 'DIVINITY'), r);
});

test('runas: vigenere de una runa con clave conocida', () => {
  // F(0) + clave "B"(ᛒ, indice 17) = indice 17
  assert.equal(c.runeVigenere('ᚠ', 'B'), 'ᛒ');
  assert.equal(c.runeVigenere('ᚠ ᚠ', 'B'), 'ᛒ ᛒ');   // el espacio no consume la clave
});

test('xor con clave es invertible y exige clave', () => {
  const data = Uint8Array.of(1, 2, 3, 4, 5);
  const enc = c.xorBytes(data, Uint8Array.of(9, 8));
  assert.deepEqual([...enc], [1 ^ 9, 2 ^ 8, 3 ^ 9, 4 ^ 8, 5 ^ 9]);
  assert.deepEqual(c.xorBytes(enc, Uint8Array.of(9, 8)), data);
  assert.throws(() => c.xorBytes(data, new Uint8Array(0)));
});

test('registro: todos los cifrados de texto son reversibles', () => {
  const sample = 'the quick brown fox, 42 times';
  for (const ci of ciphers) {
    const key = ci.key === 'number' ? 7 : ci.key === 'text' ? 'primus' : undefined;
    const plain = ci.id.startsWith('rune') && ci.id !== 'runes' ? c.toRunes(sample) : sample;
    if (ci.id === 'runes') { assert.equal(ci.decode(ci.encode('the bad path of men')), 'THE BAD PATH OF MEN'); assert.equal(ci.decode(ci.encode(sample)), 'THE CWUICC BROWN FOX, 42 TIMES', 'K y Q no tienen runa propia: la ida y vuelta no es exacta'); continue; }
    assert.equal(ci.decode(ci.encode(plain, key), key), plain, ci.id);
  }
});
