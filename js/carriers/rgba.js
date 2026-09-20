/**
 * Imagen RGBA (canvas.getImageData). Usa el bit menos significativo de R, G y B: 3 ranuras por pixel.
 * El canal alfa no se toca ni se usa: hay que exportar como PNG opaco (un formato con perdida rompe el mensaje).
 */
export class RgbaCarrier {
  /** @param {Uint8ClampedArray|Uint8Array} pixels */
  constructor(pixels) {
    if (pixels.length % 4) throw new RangeError('los datos no son RGBA');
    this.pixels = pixels;
    this.slots = (pixels.length / 4) * 3;
  }

  index(i) { return ((i / 3) | 0) * 4 + (i % 3); }

  getBit(i) { return this.pixels[this.index(i)] & 1; }

  /** LSB matching: si el bit no coincide, suma o resta 1 al azar (sin salirse de 0..255) en vez de forzar el bit. */
  setBit(i, bit, rng) {
    const p = this.index(i);
    const v = this.pixels[p];
    if ((v & 1) === bit) return;
    if (v === 0) this.pixels[p] = 1;
    else if (v === 255) this.pixels[p] = 254;
    else this.pixels[p] = rng.u32() & 1 ? v + 1 : v - 1;
  }
}
