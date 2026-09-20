// Herramientas de analisis para el que quiere descubrir si una imagen esconde algo (o comprobar lo que esconde la tuya).

/** funcion gamma incompleta regularizada superior Q(a, x) (Numerical Recipes: serie para x < a+1, fraccion continua si no). */
export function gammaQ(a, x) {
  if (x <= 0) return 1;
  const lg = lnGamma(a);
  if (x < a + 1) {
    let sum = 1 / a, term = sum;
    for (let n = 1; n < 500; n++) { term *= x / (a + n); sum += term; if (Math.abs(term) < Math.abs(sum) * 1e-14) break; }
    return Math.max(0, Math.min(1, 1 - sum * Math.exp(-x + a * Math.log(x) - lg)));
  }
  let b = x + 1 - a, c = 1 / 1e-300, d = 1 / b, h = d;
  for (let i = 1; i < 500; i++) {
    const an = -i * (i - a);
    b += 2;
    d = an * d + b; if (Math.abs(d) < 1e-300) d = 1e-300;
    c = b + an / c; if (Math.abs(c) < 1e-300) c = 1e-300;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < 1e-14) break;
  }
  return Math.max(0, Math.min(1, Math.exp(-x + a * Math.log(x) - lg) * h));
}

function lnGamma(z) {
  const c = [76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
  let y = z, x = z;
  let tmp = x + 5.5;
  tmp -= (x + 0.5) * Math.log(tmp);
  let ser = 1.000000000190015;
  for (const cj of c) ser += cj / ++y;
  return -tmp + Math.log((2.5066282746310005 * ser) / x);
}

/** p-valor de una chi-cuadrado con `df` grados de libertad. */
export const chiSquarePValue = (stat, df) => gammaQ(df / 2, stat / 2);

/**
 * Ataque chi-cuadrado de Westfeld y Pfitzmann sobre pares de valores (2k, 2k+1): incrustar bits por sustitucion
 * iguala las dos frecuencias de cada par. p cercano a 1 = las parejas estan igualadas = sospechoso de LSB por sustitucion.
 * OJO: no detecta LSB matching (+/-1), que es lo que usa umbra; para eso sirve el mapa del plano de bits.
 * @param {ArrayLike<number>} values muestras (0..255) de un mismo canal o de todos
 */
export function pairsChiSquare(values) {
  const h = new Float64Array(256);
  for (let i = 0; i < values.length; i++) h[values[i]]++;
  let stat = 0, df = 0;
  for (let k = 0; k < 128; k++) {
    const e = (h[2 * k] + h[2 * k + 1]) / 2;
    if (e < 5) continue;                       // clases con pocas muestras falsean la chi-cuadrado
    stat += ((h[2 * k] - e) ** 2) / e;
    df++;
  }
  if (df < 2) return { stat: 0, df: 0, p: NaN };
  return { stat, df, p: chiSquarePValue(stat, df - 1) };
}

/** valores de los canales R, G y B de un buffer RGBA (sin alfa). */
export function rgbValues(pixels) {
  const out = new Uint8Array((pixels.length / 4) * 3);
  for (let i = 0, o = 0; i < pixels.length; i += 4) { out[o++] = pixels[i]; out[o++] = pixels[i + 1]; out[o++] = pixels[i + 2]; }
  return out;
}

/** proporcion de unos en el bit menos significativo. una imagen natural se aleja de 0.5; una region con datos, no. */
export function lsbOnes(values) {
  let ones = 0;
  for (let i = 0; i < values.length; i++) ones += values[i] & 1;
  return values.length ? ones / values.length : NaN;
}

/**
 * Mide por bloques cuanto se parece el plano LSB a ruido puro: en fotos reales el LSB tiene estructura local
 * (vecinos que se parecen); donde hay datos cifrados, dos vecinos coinciden la mitad de las veces.
 * Devuelve, por bloque, la tasa de coincidencia entre LSB de pixeles vecinos (0.5 = ruido, mas = estructura).
 */
export function lsbNeighbourMap(pixels, width, height, block = 16, channel = 0) {
  const bx = Math.ceil(width / block), by = Math.ceil(height / block);
  const same = new Float64Array(bx * by), total = new Float64Array(bx * by);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x + 1 < width; x++) {
      const i = (y * width + x) * 4 + channel, j = i + 4;
      const b = Math.floor(y / block) * bx + Math.floor(x / block);
      total[b]++;
      if ((pixels[i] & 1) === (pixels[j] & 1)) same[b]++;
    }
  }
  return { bx, by, rate: Array.from(same, (s, i) => (total[i] ? s / total[i] : NaN)) };
}

export function histogram(values) {
  const h = new Uint32Array(256);
  for (let i = 0; i < values.length; i++) h[values[i]]++;
  return h;
}

/**
 * imagen en blanco y negro con el plano de bits `plane` (0 = menos significativo) del canal 0/1/2, o de los tres si es 'rgb'.
 * Es la forma clasica de "ver" un mensaje escondido en los LSB.
 */
export function bitPlane(pixels, plane, channel = 0) {
  const out = new Uint8ClampedArray(pixels.length);
  for (let i = 0; i < pixels.length; i += 4) {
    const bit = channel === 'rgb'
      ? ((pixels[i] >> plane) & 1) | (((pixels[i + 1] >> plane) & 1) << 1) | (((pixels[i + 2] >> plane) & 1) << 2)
      : (pixels[i + channel] >> plane) & 1;
    const v = channel === 'rgb' ? [bit & 1, (bit >> 1) & 1, (bit >> 2) & 1] : [bit, bit, bit];
    out[i] = v[0] * 255; out[i + 1] = v[1] * 255; out[i + 2] = v[2] * 255; out[i + 3] = 255;
  }
  return out;
}
