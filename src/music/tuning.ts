import { mod12, type PitchClass } from "./notes";

export const MIN_REF_A = 415;
export const MAX_REF_A = 446;

/**
 * Perustaajuuden arvio harmonic product spectrumilla (3 osasäveltä),
 * tarkennettuna paraabelisovituksella. mags = lineaarinen magnitudispektri.
 */
export function estimateFundamental(
  mags: ArrayLike<number>,
  sampleRate: number,
  fftSize: number,
  minHz = 50,
  maxHz = 1500,
): number | null {
  const binHz = sampleRate / fftSize;
  const n = mags.length;
  const lo = Math.max(2, Math.floor(minHz / binHz));
  const hi = Math.min(Math.floor((n - 2) / 3), Math.ceil(maxHz / binHz));
  let bestK = -1;
  let best = 0;
  for (let k = lo; k <= hi; k++) {
    // Sallitaan ±1 bin heitto ylemmillä osasävelillä.
    const h2 = Math.max(mags[2 * k - 1], mags[2 * k], mags[2 * k + 1]);
    const h3 = Math.max(mags[3 * k - 1], mags[3 * k], mags[3 * k + 1]);
    const p = mags[k] * h2 * h3;
    if (p > best) {
      best = p;
      bestK = k;
    }
  }
  if (bestK < 0 || best <= 0) return null;
  // Hienosäätö: paikallinen huippu ±1 bin ja paraabeli logaritmisilla arvoilla.
  let k = bestK;
  if (mags[k + 1] > mags[k]) k++;
  else if (mags[k - 1] > mags[k]) k--;
  const a = Math.log(mags[k - 1] + 1e-12);
  const b = Math.log(mags[k] + 1e-12);
  const c = Math.log(mags[k + 1] + 1e-12);
  const denom = a - 2 * b + c;
  const delta = denom === 0 ? 0 : (0.5 * (a - c)) / denom;
  return (k + Math.max(-0.5, Math.min(0.5, delta))) * binHz;
}

/**
 * Laskee A4-viritystaajuuden, kun soitettu sävel (sävelluokka `pc`, mikä tahansa
 * oktaavi) soi taajuudella `freq`. Palauttaa null, jos tulos on selvästi
 * sallitun alueen ulkopuolella (todennäköisesti väärä sävel tai yläsävel).
 */
export function refAFromNote(freq: number, pc: PitchClass = 9): number | null {
  if (!(freq > 0)) return null;
  const asA = freq * Math.pow(2, mod12(9 - pc) / 12);
  const octaves = Math.round(Math.log2(440 / asA));
  const ref = asA * Math.pow(2, octaves);
  if (ref < MIN_REF_A - 8 || ref > MAX_REF_A + 8) return null;
  return Math.round(Math.min(MAX_REF_A, Math.max(MIN_REF_A, ref)) * 10) / 10;
}

export function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
