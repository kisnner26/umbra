import * as c from './classic.js';
import { gematria } from './runes.js';

/**
 * Registro de cifrados de texto. Cada uno: id, nombre, que clave pide ('none' | 'number' | 'text') y encode/decode.
 * Añadir uno nuevo es añadir un objeto aqui: la interfaz lee esta lista.
 */
export const ciphers = [
  { id: 'runes', name: 'Runas (Gematria Primus)', key: 'none', encode: (t) => c.toRunes(t), decode: (t) => c.fromRunes(t) },
  { id: 'rune-shift', name: 'Desplazamiento de runas', key: 'number', encode: (t, k) => c.runeShift(t, +k), decode: (t, k) => c.runeShift(t, -k) },
  { id: 'rune-vigenere', name: 'Vigenère sobre runas', key: 'text', encode: (t, k) => c.runeVigenere(t, k), decode: (t, k) => c.runeVigenere(t, k, true) },
  { id: 'rune-atbash', name: 'Atbash de runas', key: 'none', encode: (t) => c.runeAtbash(t), decode: (t) => c.runeAtbash(t) },
  { id: 'caesar', name: 'César', key: 'number', encode: (t, k) => c.caesar(t, +k), decode: (t, k) => c.caesar(t, -k) },
  { id: 'atbash', name: 'Atbash', key: 'none', encode: (t) => c.atbash(t), decode: (t) => c.atbash(t) },
  { id: 'vigenere', name: 'Vigenère', key: 'text', encode: (t, k) => c.vigenere(t, k), decode: (t, k) => c.vigenere(t, k, true) },
];

export const cipherById = (id) => ciphers.find((x) => x.id === id);
export { gematria };
