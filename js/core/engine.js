import { Prng } from './prng.js';
import { slotSeeds } from './seal.js';
import { buildStream, unwrap, unpackPayload } from './frame.js';
import { readU32be } from './bytes.js';
import { UmbraError } from './errors.js';

/**
 * Un portador de "ranuras": cada ranura guarda un bit en el bit menos significativo de una muestra.
 * @typedef {{ slots: number, getBit(i: number): 0|1, setBit(i: number, bit: 0|1, rng: Prng): void }} SlotCarrier
 */

/**
 * Permutacion pseudoaleatoria perezosa de [0, n): Fisher-Yates que solo guarda lo que ha movido, asi que sacar k
 * posiciones cuesta O(k) de memoria aunque n sean millones. Las k primeras no dependen de cuantas se pidan despues.
 */
export class SlotPermutation {
  constructor(n, prng) { this.n = n; this.prng = prng; this.i = 0; this.moved = new Map(); }

  next() {
    if (this.i >= this.n) throw new RangeError('no quedan posiciones');
    const i = this.i++;
    const j = i + this.prng.below(this.n - i);
    const vi = this.moved.get(i) ?? i;
    const vj = this.moved.get(j) ?? j;
    this.moved.set(j, vi);
    this.moved.delete(i);
    return vj;
  }
}

/** bytes de carga util que caben en un portador (descontando longitud y la cabecera minima). */
export function capacityBytes(carrier, { encrypted = true } = {}) {
  const overhead = 4 + 4 + (encrypted ? 16 + 12 + 16 : 4 + 4); // longitud + cabecera interna + sal/iv/etiqueta o magic/crc
  return Math.max(0, Math.floor(carrier.slots / 8) - overhead);
}

/**
 * Esconde `payload` en `carrier` (lo modifica). Cambia como mucho +/-1 en las muestras que toca (LSB matching) y las
 * elige en un orden que solo conoce quien tiene la clave.
 * @param {SlotCarrier} carrier
 * @param {{type: number, name?: string, data: Uint8Array}} payload
 */
export async function embed(carrier, payload, passphrase = '', { iterations } = {}) {
  const stream = await buildStream(payload, passphrase, iterations);
  const need = stream.length * 8;
  if (need > carrier.slots) {
    throw new UmbraError('capacity', 'el mensaje no cabe en este portador', { need, have: carrier.slots });
  }
  const seeds = await slotSeeds(passphrase, iterations);
  const perm = new SlotPermutation(carrier.slots, new Prng(seeds.positions));
  const noise = new Prng(seeds.noise);
  for (let k = 0; k < stream.length; k++) {
    for (let b = 7; b >= 0; b--) carrier.setBit(perm.next(), (stream[k] >> b) & 1, noise);
  }
  return { bitsUsed: need, slots: carrier.slots };
}

/** lee `count` bits siguientes de la permutacion como bytes. */
function readBytes(carrier, perm, count) {
  const out = new Uint8Array(count);
  for (let k = 0; k < count; k++) {
    let v = 0;
    for (let b = 0; b < 8; b++) v = (v << 1) | carrier.getBit(perm.next());
    out[k] = v;
  }
  return out;
}

/** saca el mensaje. lanza UmbraError('nomessage' | 'wrongkey') si no hay nada que leer con esa clave. */
export async function extract(carrier, passphrase = '', { iterations } = {}) {
  if (carrier.slots < 64) throw new UmbraError('nomessage', 'el portador es demasiado pequeño');
  const seeds = await slotSeeds(passphrase, iterations);
  const perm = new SlotPermutation(carrier.slots, new Prng(seeds.positions));
  const len = readU32be(readBytes(carrier, perm, 4));
  if (len === 0 || (len + 4) * 8 > carrier.slots) {
    throw new UmbraError(passphrase ? 'wrongkey' : 'nomessage', 'no hay ningun mensaje con esta clave');
  }
  const inner = await unwrap(readBytes(carrier, perm, len), passphrase, iterations);
  return unpackPayload(inner);
}
