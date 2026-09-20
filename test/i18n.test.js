import test from 'node:test';
import assert from 'node:assert/strict';
import { keys } from '../scripts/i18n-keys.mjs';
import { en } from '../js/i18n/en.js';
import { t, setLang, getLang } from '../js/i18n.js';

test('todo texto traducible de la interfaz tiene su traduccion al ingles', () => {
  const missing = keys().filter((k) => !(k in en));
  assert.deepEqual(missing, [], `sin traducir:\n${missing.join('\n')}`);
});

test('no sobran traducciones de textos que ya no existen', () => {
  const live = new Set(keys());
  const stale = Object.keys(en).filter((k) => !live.has(k));
  assert.deepEqual(stale, [], `sobran:\n${stale.join('\n')}`);
});

test('las traducciones conservan los mismos {marcadores}', () => {
  const marks = (s) => (s.match(/\{\w+\}/g) ?? []).sort().join();
  for (const [es, english] of Object.entries(en)) assert.equal(marks(english), marks(es), es);
});

test('t: español devuelve la clave, ingles la traduccion, y se interpolan las variables', () => {
  setLang('es');
  assert.equal(t('nivel {n}', { n: 2 }), 'nivel 2');
  assert.equal(t('texto que no existe'), 'texto que no existe');
  setLang('en');
  assert.equal(t('nivel {n}', { n: 2 }), 'level 2');
  assert.equal(t('texto que no existe'), 'texto que no existe', 'lo que no esta traducido se queda en español');
  assert.equal(t('nivel {n}', {}), 'level {n}', 'un marcador sin valor se deja tal cual');
  assert.equal(getLang(), 'en');
  setLang('fr');
  assert.equal(getLang(), 'es', 'un idioma desconocido vuelve al español');
});
