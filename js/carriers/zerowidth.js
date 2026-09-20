import { readU32be } from '../core/bytes.js';
import { buildStream, unwrap, unpackPayload } from '../core/frame.js';
import { UmbraError } from '../core/errors.js';

// cuatro caracteres invisibles = 2 bits por caracter: ZWSP, WORD JOINER, INVISIBLE TIMES e INVISIBLE SEPARATOR.
// no se usan ZWJ ni ZWNJ: los emojis compuestos y varios alfabetos los necesitan de verdad y borrarlos rompe el texto.
const SYMBOLS = ['\u200b', '\u2060', '\u2062', '\u2063'];
const STRIP = /[\u200b\u2060\u2062\u2063]/g;

/** texto de portada sin invisibles previos (si no, se mezclarian con el mensaje). */
export const clean = (text) => text.replace(STRIP, '');

/** cuantos bytes de mensaje caben: no hay limite tecnico, pero cada byte añade 4 caracteres invisibles. */
export const symbolsFor = (bytes) => bytes * 4;

/**
 * Esconde la carga en `cover` repartiendo los caracteres invisibles por el texto.
 * Las posiciones no dependen de la clave (un texto no tiene "ranuras"): lo que protege el mensaje es el cifrado.
 */
export async function hideInText(cover, payload, passphrase = '', { iterations } = {}) {
  const text = [...clean(cover)];
  if (!text.length) throw new UmbraError('capacity', 'el texto de portada esta vacio', { need: 1, have: 0 });
  const stream = await buildStream(payload, passphrase, iterations);
  const symbols = [];
  for (const byte of stream) for (let s = 6; s >= 0; s -= 2) symbols.push(SYMBOLS[(byte >> s) & 3]);
  const out = text.map((ch) => [ch]);
  symbols.forEach((sym, i) => out[Math.floor((i * text.length) / symbols.length)].push(sym));
  return out.map((g) => g.join('')).join('');
}

export function hasHidden(text) {
  return /[\u200b\u2060\u2062\u2063]/.test(text);
}

export async function extractFromText(text, passphrase = '', { iterations } = {}) {
  const bits = [];
  for (const ch of text) {
    const s = SYMBOLS.indexOf(ch);
    if (s >= 0) bits.push(s);
  }
  if (bits.length < 16 || bits.length % 4) throw new UmbraError('nomessage', 'este texto no contiene ningun mensaje');
  const bytes = new Uint8Array(bits.length / 4);
  for (let i = 0; i < bytes.length; i++) bytes[i] = (bits[i * 4] << 6) | (bits[i * 4 + 1] << 4) | (bits[i * 4 + 2] << 2) | bits[i * 4 + 3];
  const len = readU32be(bytes, 0);
  if (len === 0 || len + 4 !== bytes.length) throw new UmbraError('nomessage', 'este texto no contiene ningun mensaje');
  return unpackPayload(await unwrap(bytes.slice(4), passphrase, iterations));
}
