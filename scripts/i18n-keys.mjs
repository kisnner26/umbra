// Lista los textos que la interfaz tiene que poder traducir: los t('...') de js/ui, las pestañas, los nombres de
// cifrados y los mensajes de error del nucleo. Lo usan las pruebas para que no se pueda añadir un texto sin traducirlo.
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const walk = (d) => fs.readdirSync(path.join(ROOT, d), { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
const unescape = (s) => s.replace(/\\'/g, "'").replace(/\\n/g, '\n').replace(/\\\\/g, '\\');

export function keys() {
  const found = new Set();
  const add = (s) => found.add(unescape(s));
  for (const f of walk('js/ui').filter((x) => x.endsWith('.js'))) {
    for (const m of read(f).matchAll(/\bt\('((?:[^'\\]|\\.)*)'/g)) add(m[1]);
  }
  for (const m of read('js/ui/app.js').matchAll(/\['(?:ocultar|revelar|cifrados|retos|analizar)', '([^']+)'/g)) add(m[1]);
  for (const m of read('js/ciphers/index.js').matchAll(/name: '((?:[^'\\]|\\.)*)'/g)) add(m[1]);
  for (const f of walk('js').filter((x) => /js\/(core|carriers|puzzle|ciphers)\//.test(x))) {
    for (const m of read(f).matchAll(/new UmbraError\('[a-z]+', '((?:[^'\\]|\\.)*)'/g)) add(m[1]);
    for (const m of read(f).matchAll(/new Error\('((?:[^'\\]|\\.)*)'/g)) add(m[1]);
  }
  return [...found].sort();
}

if (process.argv[1] === import.meta.filename) console.log(keys().map((k) => JSON.stringify(k)).join('\n'));
