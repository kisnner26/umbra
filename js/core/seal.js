import { concat } from './bytes.js';

// clave -> bytes: PBKDF2-SHA256 con sal fija de aplicacion para las posiciones (tiene que poder recalcularse
// sin haber leido nada del portador) y sal aleatoria por mensaje para el cifrado.
export const ITERATIONS = 200_000;
const APP_SALT = new TextEncoder().encode('umbra/v1/slots');

async function pbkdf2(passphrase, salt, bits, iterations = ITERATIONS) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(passphrase.normalize('NFKC')), 'PBKDF2', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, bits));
}

/** semillas para las posiciones y para el ruido +/-1, derivadas de la clave. 32 bytes: 16 + 16. */
export async function slotSeeds(passphrase, iterations = ITERATIONS) {
  const b = await pbkdf2(passphrase, APP_SALT, 256, iterations);
  return { positions: b.slice(0, 16), noise: b.slice(16, 32) };
}

/** AES-256-GCM con clave de PBKDF2. Devuelve sal(16) | iv(12) | cifrado+etiqueta. */
export async function seal(plain, passphrase, iterations = ITERATIONS) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await aesKey(passphrase, salt, iterations);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plain));
  return concat(salt, iv, ct);
}

/** lanza si la clave es incorrecta o los datos estan alterados (la etiqueta GCM no coincide). */
export async function open(sealed, passphrase, iterations = ITERATIONS) {
  if (sealed.length < 16 + 12 + 16) throw new Error('datos demasiado cortos');
  const salt = sealed.slice(0, 16), iv = sealed.slice(16, 28), ct = sealed.slice(28);
  const key = await aesKey(passphrase, salt, iterations);
  try {
    return new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct));
  } catch {
    throw new Error('clave incorrecta o datos alterados');
  }
}

async function aesKey(passphrase, salt, iterations) {
  const raw = await pbkdf2(passphrase, salt, 256, iterations);
  return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
}
