import { mod12, type PitchClass } from "./notes";

export interface ChromaOptions {
  /** Viritys: A4-taajuus Hz */
  refA: number;
  /** Matalin ja korkein analysoitava MIDI-sävel */
  minMidi: number;
  maxMidi: number;
  /** Yläsävelten vähennyksen voimakkuus 0–1 */
  harmonicSuppression: number;
  /** Bassosävel: matalin sävel, jonka energia on vähintään tämä osuus maksimista */
  bassRatio: number;
}

export const DEFAULT_CHROMA_OPTIONS: ChromaOptions = {
  refA: 440,
  minMidi: 36, // C2 ≈ 65 Hz
  maxMidi: 96, // C7 ≈ 2093 Hz
  // Oikeilla pianonäytteillä (10/2026) vähennys söi soitettuja kvinttejä (esim. C3:n
  // 3. osasävel = G4) ja heikensi tunnistusta selvästi. Uruilla voi nostaa asetuksista.
  harmonicSuppression: 0,
  bassRatio: 0.3,
};

export const midiToFreq = (midi: number, refA = 440): number => refA * Math.pow(2, (midi - 69) / 12);

/**
 * Yläsävelet, jotka osuvat ERI sävelluokkaan kuin perussävel
 * (oktaavit 2., 4., 8. eivät vääristä kromagrammia, joten niitä ei vähennetä).
 * [puolisävelaskelia perussävelestä, suhteellinen paino]
 */
const NON_OCTAVE_HARMONICS: [number, number][] = [
  [19, 1.0], // 3. osasävel: kvintti (myös 2 2/3' -äänikerta)
  [28, 0.7], // 5. osasävel: terssi (1 3/5' terssiäänikerta)
  [31, 0.6], // 6. osasävel: kvintti
  [34, 0.3], // 7. osasävel: pieni septimi (matala)
];

/**
 * Lineaarisesta magnitudispektristä sävelkohtaiset energiat (indeksi = midi - minMidi).
 * Jokaisen sävelen arvo on suurin paikallinen huippu ±50 sentin alueella,
 * jolloin pääkeilan vuoto naapurisäveliin ei näy omana sävelenään.
 */
export function spectrumToNotes(
  mags: ArrayLike<number>,
  sampleRate: number,
  fftSize: number,
  opts: Pick<ChromaOptions, "refA" | "minMidi" | "maxMidi">,
): number[] {
  const binHz = sampleRate / fftSize;
  const n = mags.length;
  const out: number[] = [];
  for (let m = opts.minMidi; m <= opts.maxMidi; m++) {
    const f = midiToFreq(m, opts.refA);
    const lo = Math.max(1, Math.floor((f * Math.pow(2, -0.5 / 12)) / binHz));
    const hi = Math.min(n - 2, Math.ceil((f * Math.pow(2, 0.5 / 12)) / binHz));
    let best = 0;
    for (let k = lo; k <= hi; k++) {
      const v = mags[k];
      if (v > best && v >= mags[k - 1] && v >= mags[k + 1]) {
        // Huipun on oltava tämän sävelen alueella (±50 senttiä), ei naapurin.
        const freq = k * binHz;
        const cents = 1200 * Math.log2(freq / f);
        if (Math.abs(cents) <= 50 + (binHz / f) * 1200 * 0.5) best = v;
      }
    }
    out.push(best);
  }
  return out;
}

/** Vähentää ei-oktaaviset yläsävelet matalista sävelistä ylöspäin. */
export function suppressHarmonics(notes: number[], strength: number): number[] {
  const e = [...notes];
  if (strength <= 0) return e;
  for (let i = 0; i < e.length; i++) {
    const base = e[i];
    if (base <= 0) continue;
    for (const [off, w] of NON_OCTAVE_HARMONICS) {
      const j = i + off;
      if (j < e.length) e[j] = Math.max(0, e[j] - strength * w * base);
    }
  }
  return e;
}

/** Perussävelten alueen painotus: täysi paino n. C2–E5, vaimenee siitä ylöspäin. */
export function registerWeight(midi: number): number {
  if (midi <= 76) return 1;
  return Math.max(0.25, 1 - (midi - 76) * 0.04);
}

export interface ChromaResult {
  /** 12 sävelluokan energiat, normalisoitu maksimiin 1 (kaikki 0, jos ei energiaa) */
  chroma: number[];
  /** Matalimman selkeän sävelen sävelluokka */
  bass: PitchClass | null;
  /** Sävelkohtaiset energiat yläsävelvähennyksen jälkeen */
  notes: number[];
}

export function noteEnergiesToChroma(notes: number[], minMidi: number, bassRatio: number): ChromaResult {
  const chroma = new Array(12).fill(0);
  let max = 0;
  for (const v of notes) max = Math.max(max, v);
  let bass: PitchClass | null = null;
  for (let i = 0; i < notes.length; i++) {
    const midi = minMidi + i;
    chroma[mod12(midi)] += notes[i] * registerWeight(midi);
    if (bass === null && max > 0 && notes[i] >= bassRatio * max && midi < minMidi + 30) bass = mod12(midi);
  }
  const cmax = Math.max(...chroma);
  if (cmax > 0) for (let i = 0; i < 12; i++) chroma[i] /= cmax;
  return { chroma, bass, notes };
}

/** Koko ketju: spektri → sävelet → yläsävelvähennys → kromagrammi + basso. */
export function computeChroma(
  mags: ArrayLike<number>,
  sampleRate: number,
  fftSize: number,
  options: Partial<ChromaOptions> = {},
): ChromaResult {
  const o = { ...DEFAULT_CHROMA_OPTIONS, ...options };
  const raw = spectrumToNotes(mags, sampleRate, fftSize, o);
  const clean = suppressHarmonics(raw, o.harmonicSuppression);
  return noteEnergiesToChroma(clean, o.minMidi, o.bassRatio);
}

/** Ajallinen tasoitus (eksponentiaalinen liukuva keskiarvo) kaikuisaa tilaa varten. */
export class ChromaSmoother {
  private state: number[] | null = null;
  private lastTime: number | null = null;

  constructor(public timeConstantMs = 150) {}

  reset(): void {
    this.state = null;
    this.lastTime = null;
  }

  push(chroma: ArrayLike<number> | null, timeMs: number): number[] {
    const dt = this.lastTime === null ? 0 : Math.max(0, timeMs - this.lastTime);
    this.lastTime = timeMs;
    const a = this.timeConstantMs <= 0 ? 0 : Math.exp(-dt / this.timeConstantMs);
    const x = chroma ?? new Array(12).fill(0);
    if (!this.state) this.state = Array.from(x as ArrayLike<number>);
    else for (let i = 0; i < 12; i++) this.state[i] = a * this.state[i] + (1 - a) * x[i];
    return [...this.state];
  }
}
