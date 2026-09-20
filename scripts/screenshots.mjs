// Genera las capturas del README con Chrome headless: abre la app, hace el flujo real (crear portador, esconder,
// revelar, analizar) y guarda el panel. Uso: node scripts/screenshots.mjs  (necesita Google Chrome instalado)
import { spawn } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const OUT = path.join(ROOT, 'docs');
const CHROME = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' };

const server = http.createServer((req, res) => {
  const p = path.join(ROOT, new URL(req.url, 'http://x').pathname.replace(/\/$/, '/index.html'));
  fs.readFile(p, (e, d) => e ? (res.writeHead(404), res.end()) : (res.writeHead(200, { 'content-type': types[path.extname(p)] ?? 'application/octet-stream' }), res.end(d)));
}).listen(8795);

const chrome = spawn(CHROME, ['--headless=new', '--remote-debugging-port=9333', '--hide-scrollbars', '--no-first-run', '--user-data-dir=/tmp/umbra-shots', 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let target;
for (let i = 0; i < 50 && !target; i++) {
  await sleep(200);
  try { target = (await (await fetch('http://127.0.0.1:9333/json')).json()).find((t) => t.type === 'page'); } catch {}
}
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0; const pending = new Map();
ws.onmessage = (m) => { const d = JSON.parse(m.data); pending.get(d.id)?.(d); };
const send = (method, params = {}) => new Promise((res, rej) => { const i = ++id; pending.set(i, (d) => (d.error ? rej(new Error(JSON.stringify(d.error))) : res(d.result))); ws.send(JSON.stringify({ id: i, method, params })); });
const evaluate = async (expression) => {
  const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? 'error en la pagina');
  return r.result.value;
};

await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 960, height: 1200, deviceScaleFactor: 2, mobile: false });

async function open(hash) {
  await send('Page.navigate', { url: `http://127.0.0.1:8795/#${hash}` });
  await sleep(700);
}
async function shot(name, selector = 'body') {
  const box = await evaluate(`(() => { const r = document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect(); return { x: 0, y: r.top + scrollY, width: innerWidth, height: r.height }; })()`);
  const { data } = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { ...box, scale: 1 } });
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, name), Buffer.from(data, 'base64'));
  console.log('guardada', name);
}
const set = (sel, v) => `(() => { const el = document.querySelector(${JSON.stringify(sel)}); el.value = ${JSON.stringify(v)}; el.dispatchEvent(new Event('input', { bubbles: true })); })()`;
const click = (text, sel = 'button') => `[...document.querySelectorAll(${JSON.stringify(sel)})].find((b) => b.textContent.trim() === ${JSON.stringify(text)}).click()`;

// 1. ocultar
await open('ocultar');
await evaluate(click('generar una imagen de ejemplo'));
await sleep(500);
await evaluate(set('.panel textarea', 'no todos los que vagan están perdidos'));
await evaluate(set('input[type=password]', 'liber primus'));
await evaluate(click('ocultar', 'button.primary'));
await sleep(2500);
await shot('ocultar.png', 'main');

// 2. revelar con el resultado real de arriba: se genera el PNG con los mismos modulos que usa la app
await evaluate(`(async () => {
  const io = await import('/js/ui/image-io.js'), eng = await import('/js/core/engine.js'), rgba = await import('/js/carriers/rgba.js'), b = await import('/js/core/bytes.js');
  const px = io.generateCover(512, 42).getContext('2d').getImageData(0, 0, 512, 512).data;
  await eng.embed(new rgba.RgbaCarrier(px), { type: 0, data: b.enc.encode('no todos los que vagan están perdidos') }, 'liber primus');
  window.__png = await io.canvasToPng(io.pixelsToCanvas(px, 512, 512));
})()`);
await evaluate(`location.hash = '#revelar'`); await sleep(400);
await evaluate(`(() => { const i = document.querySelector('.panel input[type=file]'); const dt = new DataTransfer(); dt.items.add(new File([window.__png], 'secreto.png', { type: 'image/png' })); i.files = dt.files; i.dispatchEvent(new Event('change', { bubbles: true })); })()`);
await sleep(700);
await evaluate(set('input[type=password]', 'liber primus'));
await evaluate(click('revelar', 'button.primary'));
await sleep(1500);
await shot('revelar.png', 'main');

// 3. cifrados
await evaluate(`location.hash = '#cifrados'`); await sleep(400);
await evaluate(set('.panel textarea', 'the path is not for the many'));
await sleep(300);
await shot('cifrados.png', 'main');

// 4. analizar: sospechosa contra original
await evaluate(`location.hash = '#analizar'`); await sleep(400);
await evaluate(`(async () => {
  const io = await import('/js/ui/image-io.js'), eng = await import('/js/core/engine.js'), rgba = await import('/js/carriers/rgba.js');
  const orig = io.generateCover(512, 42); const px = Uint8ClampedArray.from(orig.getContext('2d').getImageData(0, 0, 512, 512).data);
  const data = new Uint8Array(12000).map((_, i) => (i * 2654435761 >>> 13) & 255);
  await eng.embed(new rgba.RgbaCarrier(px), { type: 1, name: 'x.bin', data }, 'k');
  const inputs = document.querySelectorAll('.panel input[type=file]');
  for (const [i, blob] of [await io.canvasToPng(io.pixelsToCanvas(px, 512, 512)), await io.canvasToPng(orig)].entries()) {
    const dt = new DataTransfer(); dt.items.add(new File([blob], i ? 'original.png' : 'sospechosa.png', { type: 'image/png' })); inputs[i].files = dt.files; inputs[i].dispatchEvent(new Event('change', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 900));
  }
})()`);
await sleep(600);
await shot('analizar.png', 'main');

ws.close(); chrome.kill(); server.close();
