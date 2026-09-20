import { concat, enc, dec, u32be, readU32be } from './bytes.js';
import { crc32 } from './crc32.js';
import { deflate, inflate } from './compress.js';
import { seal, open } from './seal.js';
import { UmbraError } from './errors.js';

export const TYPE = { text: 0, file: 1 };
const VERSION = 1;
const MAGIC = enc.encode('UMB1');
const FLAG_COMPRESSED = 1;

/** carga util: tipo, nombre (solo archivos) y datos. Comprime solo si de verdad ahorra bytes. */
export async function packPayload({ type, name = '', data }) {
  const nameBytes = enc.encode(name);
  if (nameBytes.length > 255) throw new UmbraError('format', 'el nombre del archivo es demasiado largo');
  let body = data, flags = 0;
  const packed = await deflate(data);
  if (packed.length < data.length) { body = packed; flags |= FLAG_COMPRESSED; }
  return concat(new Uint8Array([VERSION, flags, type, nameBytes.length]), nameBytes, body);
}

export async function unpackPayload(inner) {
  if (inner.length < 4 || inner[0] !== VERSION) throw new UmbraError('format', 'formato desconocido');
  const [, flags, type, nameLen] = inner;
  if (inner.length < 4 + nameLen) throw new UmbraError('format', 'cabecera truncada');
  const name = dec.decode(inner.slice(4, 4 + nameLen));
  let data = inner.slice(4 + nameLen);
  if (flags & FLAG_COMPRESSED) {
    try { data = await inflate(data); } catch { throw new UmbraError('format', 'datos comprimidos corruptos'); }
  }
  return { type, name, data };
}

/**
 * lo que se esconde de verdad. con clave: sal | iv | AES-GCM. sin clave: 'UMB1' | carga | crc32
 * (sin clave solo se ofusca: cualquiera con la herramienta puede leerlo).
 */
export async function wrap(inner, passphrase, iterations) {
  if (passphrase) return seal(inner, passphrase, iterations);
  return concat(MAGIC, inner, u32be(crc32(inner)));
}

export async function unwrap(body, passphrase, iterations) {
  if (passphrase) {
    try { return await open(body, passphrase, iterations); } catch (e) { throw new UmbraError('wrongkey', e.message); }
  }
  if (body.length < MAGIC.length + 4 || MAGIC.some((b, i) => body[i] !== b)) throw new UmbraError('nomessage', 'no hay ningun mensaje (o necesita clave)');
  const inner = body.slice(MAGIC.length, body.length - 4);
  if (crc32(inner) !== readU32be(body, body.length - 4)) throw new UmbraError('nomessage', 'no hay ningun mensaje (o necesita clave)');
  return inner;
}

/** flujo completo que se incrusta: longitud (4 bytes) | cuerpo. */
export async function buildStream(payload, passphrase, iterations) {
  const body = await wrap(await packPayload(payload), passphrase, iterations);
  return concat(u32be(body.length), body);
}
