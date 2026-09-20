import { concat, enc, dec, u32be, readU32be } from './bytes.js';
import { UmbraError } from './errors.js';

const MAGIC = enc.encode('UMBB');

/**
 * Un paquete: un texto y varios archivos en una sola carga. Es lo que permite que una imagen lleve a la vez el mensaje de
 * su nivel y la imagen del siguiente. Formato: 'UMBB' | u32 largo del texto | texto | u8 nº archivos |
 * por archivo: u8 largo del nombre | nombre | u32 largo | datos.
 */
export function packBundle({ text = '', files = [] }) {
  if (files.length > 255) throw new UmbraError('format', 'demasiados archivos en el paquete');
  const t = enc.encode(text);
  const parts = [MAGIC, u32be(t.length), t, new Uint8Array([files.length])];
  for (const f of files) {
    const name = enc.encode(f.name);
    if (name.length > 255) throw new UmbraError('format', 'el nombre del archivo es demasiado largo');
    parts.push(new Uint8Array([name.length]), name, u32be(f.data.length), f.data);
  }
  return concat(...parts);
}

export function unpackBundle(bytes) {
  const bad = () => new UmbraError('format', 'paquete corrupto');
  if (bytes.length < 9 || MAGIC.some((b, i) => bytes[i] !== b)) throw bad();
  let o = 4;
  const tl = readU32be(bytes, o); o += 4;
  if (o + tl + 1 > bytes.length) throw bad();
  const text = dec.decode(bytes.slice(o, o + tl)); o += tl;
  const n = bytes[o++];
  const files = [];
  for (let i = 0; i < n; i++) {
    if (o >= bytes.length) throw bad();
    const nl = bytes[o++];
    if (o + nl + 4 > bytes.length) throw bad();
    const name = dec.decode(bytes.slice(o, o + nl)); o += nl;
    const len = readU32be(bytes, o); o += 4;
    if (o + len > bytes.length) throw bad();
    files.push({ name, data: bytes.slice(o, o + len) }); o += len;
  }
  if (o !== bytes.length) throw bad();
  return { text, files };
}
