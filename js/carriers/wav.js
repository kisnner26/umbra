import { UmbraError } from '../core/errors.js';

/** localiza el bloque 'data' de un WAV PCM de 16 bits y devuelve dónde empiezan y acaban las muestras. */
export function parseWav(bytes) {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const tag = (o) => String.fromCharCode(bytes[o], bytes[o + 1], bytes[o + 2], bytes[o + 3]);
  if (bytes.length < 44 || tag(0) !== 'RIFF' || tag(8) !== 'WAVE') throw new UmbraError('format', 'no es un archivo WAV');
  const limit = v.getUint32(4, true) + 8;
  if (limit < 12 || limit > bytes.length) throw new UmbraError('format', 'el WAV está truncado');
  let o = 12, fmt = null;
  while (o + 8 <= limit) {
    const size = v.getUint32(o + 4, true);
    if (o + 8 + size + (size & 1) > limit) throw new UmbraError('format', 'el bloque WAV está truncado');
    if (tag(o) === 'fmt ') {
      if (size < 16) throw new UmbraError('format', 'el bloque fmt del WAV está truncado');
      fmt = { format: v.getUint16(o + 8, true), bits: v.getUint16(o + 22, true) };
    }
    if (tag(o) === 'data') {
      if (!fmt || fmt.format !== 1 || fmt.bits !== 16) throw new UmbraError('format', 'solo se admite WAV PCM de 16 bits');
      const start = o + 8;
      return { start, end: start + size };
    }
    o += 8 + size + (size & 1);
  }
  throw new UmbraError('format', 'el WAV no tiene bloque de datos');
}

/** una ranura por muestra de 16 bits: el bit menos significativo de su byte bajo. */
export class WavCarrier {
  constructor(bytes) {
    this.bytes = bytes;
    const { start, end } = parseWav(bytes);
    this.start = start;
    this.slots = Math.floor((end - start) / 2);
  }

  getBit(i) { return this.bytes[this.start + i * 2] & 1; }

  setBit(i, bit, rng) {
    const p = this.start + i * 2;
    const low = this.bytes[p];
    if ((low & 1) === bit) return;
    // +/-1 sobre la muestra completa (little-endian) para no dar saltos de 255 al cruzar el byte
    const sample = (this.bytes[p + 1] << 8 | low) << 16 >> 16;
    let next = rng.u32() & 1 ? sample + 1 : sample - 1;
    if (next > 32767) next = sample - 1; else if (next < -32768) next = sample + 1;
    this.bytes[p] = next & 255;
    this.bytes[p + 1] = (next >> 8) & 255;
  }
}

/** WAV de prueba/portador: seno con un poco de ruido, 16 bits mono. */
export function makeWav(samples, sampleRate = 44100) {
  const data = samples.length * 2;
  const out = new Uint8Array(44 + data);
  const v = new DataView(out.buffer);
  const w = (o, s) => [...s].forEach((c, i) => { out[o + i] = c.charCodeAt(0); });
  w(0, 'RIFF'); v.setUint32(4, 36 + data, true); w(8, 'WAVE'); w(12, 'fmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, sampleRate, true); v.setUint32(28, sampleRate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  w(36, 'data'); v.setUint32(40, data, true);
  samples.forEach((s, i) => v.setInt16(44 + i * 2, s, true));
  return out;
}
