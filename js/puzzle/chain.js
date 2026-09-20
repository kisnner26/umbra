import { embed, extract, capacityBytes } from '../core/engine.js';
import { RgbaCarrier } from '../carriers/rgba.js';
import { TYPE } from '../core/frame.js';
import { packBundle, unpackBundle } from '../core/bundle.js';
import { enc } from '../core/bytes.js';
import { cipherById } from '../ciphers/index.js';
import { UmbraError } from '../core/errors.js';

/**
 * Retos encadenados estilo Cicada: el nivel 1 es una imagen; con su clave revela un mensaje y la imagen del nivel 2;
 * esa, con otra clave, la del 3, y asi hasta el final. Solo se publica la del nivel 1.
 *
 * `levels[i]` = { pass, message, cipher?: {id, key}, clue?, seed? }
 *   pass    clave que abre ese nivel (obligatoria: sin clave no hay reto)
 *   message lo que el jugador lee al abrirlo; si hay `cipher`, se guarda ya cifrado con ese cifrado
 *   clue    pista visible que el portador puede dibujar (la usa `makeCarrier`)
 *
 * Los efectos (crear la imagen y codificarla como PNG) se inyectan, asi la logica se prueba sin navegador:
 * @param {{ makeCarrier(level, index, neededBytes): {pixels: Uint8ClampedArray, width: number, height: number},
 *           encodeImage(carrier): Promise<Uint8Array> }} io
 */
export async function buildChain(levels, io, { iterations, margin = 1.03 } = {}) {
  if (!levels.length) throw new UmbraError('format', 'el reto necesita al menos un nivel');
  levels.forEach((l, i) => { if (!l.pass) throw new UmbraError('format', 'cada nivel necesita una clave', { level: i + 1 }); });

  const images = new Array(levels.length);     // bytes del archivo de imagen de cada nivel
  const solution = [];
  // de dentro hacia fuera: el ultimo nivel no contiene ninguna imagen; los demas contienen la del siguiente
  for (let i = levels.length - 1; i >= 0; i--) {
    const level = levels[i];
    const shown = level.cipher?.id && level.cipher.id !== 'none'
      ? cipherById(level.cipher.id).encode(level.message, level.cipher.key)
      : level.message;
    const files = i < levels.length - 1 ? [{ name: `nivel-${i + 2}.png`, data: images[i + 1] }] : [];
    const data = packBundle({ text: shown, files });

    // el portador tiene que ser lo bastante grande: se pide uno con margen sobre lo que va a llevar
    const needed = Math.ceil(data.length * margin) + 80;
    const carrier = io.makeCarrier(level, i, needed);
    const cap = capacityBytes(new RgbaCarrier(carrier.pixels), { encrypted: true });
    if (data.length > cap) {
      throw new UmbraError('capacity', 'el portador de un nivel es demasiado pequeño', { need: data.length * 8, have: cap * 8, level: i + 1 });
    }
    await embed(new RgbaCarrier(carrier.pixels), { type: TYPE.bundle, data }, level.pass, { iterations });
    images[i] = await io.encodeImage(carrier);
    solution.unshift({ level: i + 1, pass: level.pass, message: level.message, shown, cipher: level.cipher ?? null, clue: level.clue ?? '', bytes: images[i].length });
  }
  return { first: images[0], images, solution };
}

/**
 * Recorre un reto con una lista de claves (una por nivel) y devuelve los mensajes. Sirve para comprobar que un reto
 * recien construido se puede resolver, y para las pruebas.
 * @param {{ decodeImage(bytes): Promise<{pixels: Uint8ClampedArray}> }} io
 */
export async function solveChain(first, passes, io, { iterations } = {}) {
  let image = first;
  const steps = [];
  for (const pass of passes) {
    const { pixels } = await io.decodeImage(image);
    const r = await extract(new RgbaCarrier(pixels), pass, { iterations });
    if (r.type !== TYPE.bundle) { steps.push({ text: new TextDecoder().decode(r.data), files: [] }); break; }
    const b = unpackBundle(r.data);
    steps.push(b);
    if (!b.files.length) break;
    image = b.files[0].data;
  }
  return steps;
}

/** una ficha en texto del reto para quien lo crea: claves, mensajes y como se cifro cada uno. */
export function solutionSheet(solution, title = 'reto') {
  const lines = [`# ${title}`, '', 'solo se publica la imagen del nivel 1. esta ficha es para ti.', ''];
  for (const s of solution) {
    lines.push(`## nivel ${s.level}`, '', `- clave: \`${s.pass}\``);
    if (s.cipher?.id && s.cipher.id !== 'none') lines.push(`- cifrado del mensaje: ${cipherById(s.cipher.id).name}${s.cipher.key ? ` (clave: ${s.cipher.key})` : ''}`);
    lines.push(`- lo que ve el jugador: ${s.shown}`, `- mensaje descifrado: ${s.message}`);
    if (s.clue) lines.push(`- pista dibujada en la imagen: ${s.clue}`);
    lines.push(`- tamaño del archivo: ${s.bytes} bytes`, '');
  }
  return lines.join('\n');
}

export const keyBytes = (s) => enc.encode(s);
