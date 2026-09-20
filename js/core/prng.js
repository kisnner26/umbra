// xoshiro128**: generador rapido y con estado de 128 bits, suficiente para elegir posiciones.
// no es criptografico por si solo: la semilla sale de PBKDF2, y sin ella la secuencia no se puede predecir.

export class Prng {
  /** @param {Uint8Array} seed al menos 16 bytes */
  constructor(seed) {
    if (seed.length < 16) throw new RangeError('la semilla necesita 16 bytes');
    const v = new DataView(seed.buffer, seed.byteOffset, seed.byteLength);
    this.s = new Uint32Array([v.getUint32(0), v.getUint32(4), v.getUint32(8), v.getUint32(12)]);
    if (!this.s.some(Boolean)) this.s[0] = 1; // el estado nulo se queda en cero para siempre
  }

  u32() {
    const s = this.s;
    const r = Math.imul(rotl(Math.imul(s[1], 5), 7), 9) >>> 0;
    const t = s[1] << 9;
    s[2] ^= s[0]; s[3] ^= s[1]; s[1] ^= s[2]; s[0] ^= s[3];
    s[2] ^= t;
    s[3] = rotl(s[3], 11);
    return r;
  }

  /** entero uniforme en [0, n) sin sesgo de modulo. */
  below(n) {
    if (!Number.isInteger(n) || n <= 0 || n > 0x100000000) throw new RangeError('n fuera de rango');
    if (n === 1) return 0;
    const limit = 0x100000000 - (0x100000000 % n);
    let x;
    do { x = this.u32(); } while (x >= limit);
    return x % n;
  }
}

function rotl(x, k) { return ((x << k) | (x >>> (32 - k))) >>> 0; }
