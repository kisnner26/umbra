/**
 * Entrada y salida de imagenes. Lo delicado: hay que leer los pixeles tal cual estan en el archivo, sin conversion de
 * color ni premultiplicado, porque un solo valor distinto en un LSB destruye el mensaje.
 */
export async function fileToPixels(file) {
  const bitmap = await createImageBitmap(file, { colorSpaceConversion: 'none', premultiplyAlpha: 'none' });
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width; canvas.height = bitmap.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true, colorSpace: 'srgb' });
  ctx.drawImage(bitmap, 0, 0);
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
  bitmap.close?.();
  let transparent = false;
  for (let i = 3; i < data.data.length; i += 4) if (data.data[i] !== 255) { transparent = true; break; }
  if (transparent) {
    // el alfa se pierde al pasar por el canvas (premultiplicado): se aplana sobre negro para que no cambie al guardar
    ctx.globalCompositeOperation = 'destination-over';
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    return { width: canvas.width, height: canvas.height, pixels: ctx.getImageData(0, 0, canvas.width, canvas.height).data, flattened: true };
  }
  return { width: canvas.width, height: canvas.height, pixels: data.data, flattened: false };
}

export function pixelsToCanvas(pixels, width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  canvas.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(pixels), width, height), 0, 0);
  return canvas;
}

export const canvasToPng = (canvas) => new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error('no se pudo codificar el PNG'))), 'image/png'));

/** imagen de portada procedural para probar sin subir nada: ruido suave coloreado, con textura (un LSB plano se notaria). */
export function generateCover(size = 512, seed = 1, { grain = 4, clue = '' } = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, size, size);
  g.addColorStop(0, '#1d2b3a'); g.addColorStop(0.5, '#5b6b73'); g.addColorStop(1, '#c9b79c');
  ctx.fillStyle = g; ctx.fillRect(0, 0, size, size);
  let s = seed >>> 0 || 1;
  const rnd = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 2 ** 32);
  for (let i = 0; i < 60; i++) {
    ctx.beginPath();
    ctx.fillStyle = `hsla(${Math.floor(rnd() * 360)}, 35%, ${30 + rnd() * 40}%, ${0.05 + rnd() * 0.12})`;
    ctx.arc(rnd() * size, rnd() * size, 20 + rnd() * size * 0.25, 0, Math.PI * 2);
    ctx.fill();
  }
  if (clue) {
    // pista visible: el texto en runas, tenue, abajo. es lo que un jugador tiene que descifrar antes de tocar los bits
    ctx.fillStyle = 'rgba(255,255,255,.55)';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `${Math.max(12, Math.round(size / 16))}px ui-monospace, Menlo, "Segoe UI Symbol", serif`;
    ctx.fillText(clue, size / 2, size * 0.92, size * 0.9);
  }
  const img = ctx.getImageData(0, 0, size, size);
  const span = grain * 2 + 1;
  for (let i = 0; i < img.data.length; i += 4) {
    const n = Math.floor(rnd() * span) - grain;     // grano fino, como el de una foto real
    img.data[i] += n; img.data[i + 1] += n; img.data[i + 2] += n;
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

/**
 * Portada "plana" para los retos: formas de color liso, sin degradados ni grano. Un degradado lo dibuja el navegador con
 * tramado (ruido) y el PNG resultante pesa 4-5 veces mas; como cada nivel tiene que caber dentro del anterior, el peso
 * de cada imagen decide lo grande que tiene que ser la de fuera. Con formas lisas el PNG casi solo pesa por lo que lleva dentro.
 */
export function generateFlatCover(size = 256, seed = 1, { clue = '' } = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  let s = seed >>> 0 || 1;
  const rnd = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 2 ** 32);
  const hue = Math.floor(rnd() * 360);
  const shade = (l) => `hsl(${(hue + Math.floor(rnd() * 50)) % 360}, ${25 + Math.floor(rnd() * 25)}%, ${l}%)`;
  ctx.fillStyle = shade(12); ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 26; i++) {
    ctx.fillStyle = shade(18 + Math.floor(rnd() * 45));
    const cx = rnd() * size, cy = rnd() * size, r = size * (0.05 + rnd() * 0.3);
    ctx.beginPath();
    if (rnd() < 0.5) ctx.arc(cx, cy, r, 0, Math.PI * 2);
    else { ctx.moveTo(cx, cy - r); ctx.lineTo(cx + r, cy + r * 0.8); ctx.lineTo(cx - r, cy + r * 0.8); ctx.closePath(); }
    ctx.fill();
  }
  if (clue) {
    ctx.fillStyle = 'rgba(255,255,255,.85)';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `${Math.max(12, Math.round(size / 16))}px ui-monospace, Menlo, "Segoe UI Symbol", serif`;
    ctx.fillText(clue, size / 2, size * 0.92, size * 0.9);
  }
  return canvas;
}
