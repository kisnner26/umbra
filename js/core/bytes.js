export const enc = new TextEncoder();
export const dec = new TextDecoder('utf-8', { fatal: true });

export function concat(...parts) {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}

export function u32be(n) {
  return new Uint8Array([(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255]);
}

export function readU32be(b, o = 0) {
  return ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0;
}

export const toHex = (b) => [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
export function fromHex(s) {
  const clean = s.replace(/\s+/g, '');
  if (clean.length % 2 || /[^0-9a-f]/i.test(clean)) throw new Error('hex invalido');
  return Uint8Array.from(clean.match(/../g) ?? [], (h) => parseInt(h, 16));
}
