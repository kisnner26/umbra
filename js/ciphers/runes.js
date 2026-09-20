// Gematria Primus: las 29 runas del futhorc anglosajon con su letra y su valor primo, como en el Liber Primus.
export const RUNES = [
  ['ᚠ', 'F', 2], ['ᚢ', 'U', 3], ['ᚦ', 'TH', 5], ['ᚩ', 'O', 7], ['ᚱ', 'R', 11], ['ᚳ', 'C', 13], ['ᚷ', 'G', 17],
  ['ᚹ', 'W', 19], ['ᚻ', 'H', 23], ['ᚾ', 'N', 29], ['ᛁ', 'I', 31], ['ᛂ', 'J', 37], ['ᛇ', 'EO', 41], ['ᛈ', 'P', 43],
  ['ᛉ', 'X', 47], ['ᛋ', 'S', 53], ['ᛏ', 'T', 59], ['ᛒ', 'B', 61], ['ᛖ', 'E', 67], ['ᛗ', 'M', 71], ['ᛚ', 'L', 73],
  ['ᛝ', 'NG', 79], ['ᛟ', 'OE', 83], ['ᛞ', 'D', 89], ['ᚪ', 'A', 97], ['ᚫ', 'AE', 101], ['ᚣ', 'Y', 103],
  ['ᛡ', 'IA', 107], ['ᛠ', 'EA', 109],
];

export const RUNE_COUNT = RUNES.length;
const byLetters = new Map(RUNES.map(([r, l], i) => [l, i]));
const byRune = new Map(RUNES.map(([r], i) => [r, i]));
// letras que no tienen runa propia se leen como otra (como en el original)
const ALIASES = { K: 'C', Q: 'CW', V: 'U', Z: 'S', ING: 'NG', IO: 'IA' };
// digrafos y trigrafos, de mas largo a mas corto para que "ING" gane a "I" + "NG"
const CLUSTERS = ['ING', 'TH', 'EO', 'NG', 'OE', 'AE', 'IA', 'IO', 'EA'];

/** texto latino -> indices de runa. lo que no es letra se conserva tal cual (como cadena). */
export function toRuneTokens(text) {
  const src = text.toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const out = [];
  for (let i = 0; i < src.length;) {
    let hit = null;
    for (const c of CLUSTERS) if (src.startsWith(c, i)) { hit = c; break; }
    if (hit) { out.push(byLetters.get(ALIASES[hit] ?? hit)); i += hit.length; continue; }
    const ch = src[i];
    const letters = ALIASES[ch] ?? ch;
    if (byLetters.has(letters)) out.push(byLetters.get(letters));
    else if (letters.length > 1 && [...letters].every((l) => byLetters.has(l))) [...letters].forEach((l) => out.push(byLetters.get(l)));
    else out.push(ch);
    i++;
  }
  return out;
}

export const tokensToRunes = (tokens) => tokens.map((t) => (typeof t === 'number' ? RUNES[t][0] : t)).join('');
export const runesToLatin = (text) => [...text].map((ch) => (byRune.has(ch) ? RUNES[byRune.get(ch)][1] : ch)).join('');
export const isRune = (ch) => byRune.has(ch);
export const runeIndex = (ch) => byRune.get(ch);

/** suma de los valores primos de las runas (la "gematria" de un texto). */
export function gematria(text) {
  let sum = 0;
  for (const ch of text) if (byRune.has(ch)) sum += RUNES[byRune.get(ch)][2];
  return sum;
}
