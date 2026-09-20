import { h, formatBytes } from './dom.js';
import { t } from '../i18n.js';

/** zona para soltar o elegir un archivo. */
export function fileDrop({ label, accept, onFile }) {
  const input = h('input', { type: 'file', accept, class: 'sr-only', onChange: () => input.files[0] && onFile(input.files[0]) });
  const box = h('label', { class: 'drop' }, input, h('span', {}, label));
  box.addEventListener('dragover', (e) => { e.preventDefault(); box.classList.add('over'); });
  box.addEventListener('dragleave', () => box.classList.remove('over'));
  box.addEventListener('drop', (e) => {
    e.preventDefault(); box.classList.remove('over');
    if (e.dataTransfer.files[0]) onFile(e.dataTransfer.files[0]);
  });
  return box;
}

/** campo de clave con ojo para verla. */
export function passField({ label = t('clave'), onInput, hint, placeholder = t('sin clave, solo se ofusca') }) {
  const input = h('input', { type: 'password', autocomplete: 'off', spellcheck: false, placeholder, onInput: () => onInput?.(input.value) });
  const eye = h('button', { type: 'button', class: 'ghost', 'aria-label': t('mostrar u ocultar la clave'), onClick: () => { input.type = input.type === 'password' ? 'text' : 'password'; } }, '👁');
  return h('div', { class: 'field' }, h('span', { class: 'label' }, label), h('div', { class: 'row' }, input, eye), hint && h('small', {}, hint));
}

/** barra de capacidad: cuanto del portador se va a usar. */
export function meter() {
  const fill = h('i');
  const text = h('small');
  const el = h('div', { class: 'meter' }, h('div', { class: 'bar' }, fill), text);
  el.set = (used, cap, note = '') => {
    const pct = cap > 0 ? Math.min(100, (used / cap) * 100) : 0;
    fill.style.width = `${pct}%`;
    el.classList.toggle('over', used > cap);
    text.textContent = `${formatBytes(used)} / ${formatBytes(cap)} (${pct.toFixed(1)} %) ${note}`;
  };
  return el;
}

export function notice(kind, text) {
  return h('p', { class: `notice ${kind}`, role: kind === 'error' ? 'alert' : 'status' }, text);
}

export function segmented(options, value, onChange) {
  const el = h('div', { class: 'seg', role: 'tablist' });
  const paint = (v) => [...el.children].forEach((b) => b.setAttribute('aria-selected', String(b.dataset.v === v)));
  options.forEach(([v, text]) => el.append(h('button', { type: 'button', role: 'tab', 'data-v': v, onClick: () => { paint(v); onChange(v); } }, text)));
  paint(value);
  el.set = paint;
  return el;
}
