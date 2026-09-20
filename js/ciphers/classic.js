import { RUNES, RUNE_COUNT, toRuneTokens, tokensToRunes, isRune, runeIndex, runesToLatin } from './runes.js';

const A = 'A'.charCodeAt(0);
const mod = (n, m) => ((n % m) + m) % m;

/** aplica `f(indice)` a cada letra latina A-Z conservando mayusculas, minusculas y todo lo demas. */
function mapLatin(text, f) {
  let k = 0;
  return [...text].map((ch) => {
    const up = ch.toUpperCase();
    if (!/^[A-Z]$/.test(up) || ch.length !== 1) return ch;
    const out = String.fromCharCode(A + mod(f(up.charCodeAt(0) - A, k++), 26));
    return ch === up ? out : out.toLowerCase();
  }).join('');
}

export function caesar(text, shift) { return mapLatin(text, (i) => i + shift); }

export function atbash(text) { return mapLatin(text, (i) => 25 - i); }

const keyShifts = (key) => {
  const k = [...key.toUpperCase()].filter((c) => /[A-Z]/.test(c)).map((c) => c.charCodeAt(0) - A);
  if (!k.length) throw new Error('la clave necesita letras A-Z');
  return k;
};

/** la clave avanza solo con las letras: espacios y signos no la consumen. */
export function vigenere(text, key, decrypt = false) {
  const k = keyShifts(key);
  return mapLatin(text, (i, n) => i + (decrypt ? -1 : 1) * k[n % k.length]);
}

// ---- sobre el alfabeto de 29 runas ------------------------------------------------------------------------------

function mapRunes(text, f) {
  let k = 0;
  return [...text].map((ch) => (isRune(ch) ? RUNES[mod(f(runeIndex(ch), k++), RUNE_COUNT)][0] : ch)).join('');
}

/** texto latino -> runas (Gematria Primus). */
export const toRunes = (text) => tokensToRunes(toRuneTokens(text));
export const fromRunes = runesToLatin;

export const runeShift = (text, shift) => mapRunes(text, (i) => i + shift);

export function runeVigenere(text, key, decrypt = false) {
  const idx = toRuneTokens(key).filter((t) => typeof t === 'number');
  if (!idx.length) throw new Error('la clave necesita letras');
  return mapRunes(text, (i, n) => i + (decrypt ? -1 : 1) * idx[n % idx.length]);
}

/** atbash sobre 29 runas: la primera con la ultima. */
export const runeAtbash = (text) => mapRunes(text, (i) => RUNE_COUNT - 1 - i);

// ---- XOR con clave (estilo libreta de un solo uso) ---------------------------------------------------------------

export function xorBytes(data, key) {
  if (!key.length) throw new Error('la clave no puede estar vacia');
  return Uint8Array.from(data, (b, i) => b ^ key[i % key.length]);
}
