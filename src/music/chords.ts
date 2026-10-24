import { finnishNoteName, mod12, pcToName, type PitchClass } from "./notes";
import type { MusicKey } from "./keys";

export type ChordQuality = "maj" | "min" | "7" | "dim" | "maj7" | "m7";

export const QUALITY_INTERVALS: Record<ChordQuality, number[]> = {
  maj: [0, 4, 7],
  min: [0, 3, 7],
  "7": [0, 4, 7, 10],
  dim: [0, 3, 6],
  maj7: [0, 4, 7, 11],
  m7: [0, 3, 7, 10],
};

const QUALITIES = Object.keys(QUALITY_INTERVALS) as ChordQuality[];

const QUALITY_SUFFIX: Record<ChordQuality, string> = {
  maj: "",
  min: "m",
  "7": "7",
  dim: "°",
  maj7: "maj7",
  m7: "m7",
};

export interface Chord {
  root: PitchClass;
  quality: ChordQuality;
}

export interface ChordMatch extends Chord {
  score: number;
}

export const chordId = (c: Chord): string => `${c.root}:${c.quality}`;
export const sameChord = (a: Chord | null, b: Chord | null): boolean =>
  a === b || (!!a && !!b && a.root === b.root && a.quality === b.quality);

export function chordPitchClasses(c: Chord): PitchClass[] {
  return QUALITY_INTERVALS[c.quality].map((i) => mod12(c.root + i));
}

/** Esim. "G7", "Fism", "H°" */
export function chordLabel(c: Chord, preferFlats = false): string {
  return finnishNoteName(pcToName(c.root, preferFlats)) + QUALITY_SUFFIX[c.quality];
}

export interface DetectOptions {
  /** Matalimman selkeän sävelen sävelluokka, käytetään pohjasävelen tulkinnassa */
  bass?: PitchClass | null;
  /** Pienin hyväksytty kosinisamankaltaisuus (0–1) */
  minScore?: number;
  /** Lisäpisteet, jos basso on soinnun pohjasävel */
  bassBonus?: number;
}

/**
 * Tunnistaa soinnun 12-alkioisesta kromagrammista vertaamalla sitä
 * sointupohjiin kosinisamankaltaisuudella. Palauttaa null, jos mikään pohja
 * ei sovi riittävän hyvin tai kaksi eri tulkintaa ovat tasoissa
 * (esim. pelkkä kvintti ilman terssiä).
 */
export function detectChord(chroma: ArrayLike<number>, opts: DetectOptions = {}): ChordMatch | null {
  const minScore = opts.minScore ?? 0.78;
  const bassBonus = opts.bassBonus ?? 0.04;
  let norm = 0;
  for (let i = 0; i < 12; i++) norm += chroma[i] * chroma[i];
  norm = Math.sqrt(norm);
  if (norm <= 1e-9) return null;

  const results: ChordMatch[] = [];
  for (const quality of QUALITIES) {
    const ivs = QUALITY_INTERVALS[quality];
    const tNorm = Math.sqrt(ivs.length);
    for (let root = 0; root < 12; root++) {
      let dot = 0;
      for (const iv of ivs) dot += chroma[(root + iv) % 12];
      let score = dot / (norm * tNorm);
      if (opts.bass != null && opts.bass === root) score += bassBonus;
      results.push({ root, quality, score });
    }
  }
  results.sort((a, b) => b.score - a.score);
  const [best, second] = results;
  if (best.score < minScore) return null;
  if (best.score - second.score < 0.005) return null;
  return best;
}

/** Tunnistus suoraan sävelluokista (testitila, yksikkötestit). */
export function detectChordFromNotes(pcs: readonly PitchClass[], bass?: PitchClass | null, minScore?: number) {
  return detectChord(notesToChroma(pcs), { bass: bass ?? null, minScore });
}

export function notesToChroma(pcs: readonly PitchClass[]): number[] {
  const c = new Array(12).fill(0);
  for (const p of pcs) c[mod12(p)] = 1;
  return c;
}

// --- Sointujen tehtävät sävellajissa ---

export const dominantRoot = (key: MusicKey): PitchClass => mod12(key.pc + 7);

/** V tai V7. Mollissakin V on duuri (johtosävel korotettu). */
export function isDominantOf(c: Chord, key: MusicKey): boolean {
  return c.root === dominantRoot(key) && (c.quality === "maj" || c.quality === "7");
}

/** I (duuri, myös Imaj7) tai i (molli). */
export function isTonicOf(c: Chord, key: MusicKey): boolean {
  if (c.root !== key.pc) return false;
  return key.mode === "major" ? c.quality === "maj" || c.quality === "maj7" : c.quality === "min";
}

export interface DiatonicChord {
  roman: string;
  chord: Chord;
}

/** Testitilan pikanapit: tavalliset soinnut sävellajissa. */
export function diatonicChords(key: MusicKey): DiatonicChord[] {
  const r = (iv: number) => mod12(key.pc + iv);
  if (key.mode === "major") {
    return [
      { roman: "I", chord: { root: r(0), quality: "maj" } },
      { roman: "ii", chord: { root: r(2), quality: "min" } },
      { roman: "ii7", chord: { root: r(2), quality: "m7" } },
      { roman: "iii", chord: { root: r(4), quality: "min" } },
      { roman: "IV", chord: { root: r(5), quality: "maj" } },
      { roman: "V", chord: { root: r(7), quality: "maj" } },
      { roman: "V7", chord: { root: r(7), quality: "7" } },
      { roman: "vi", chord: { root: r(9), quality: "min" } },
      { roman: "vii°", chord: { root: r(11), quality: "dim" } },
    ];
  }
  return [
    { roman: "i", chord: { root: r(0), quality: "min" } },
    { roman: "ii°", chord: { root: r(2), quality: "dim" } },
    { roman: "III", chord: { root: r(3), quality: "maj" } },
    { roman: "iv", chord: { root: r(5), quality: "min" } },
    { roman: "V", chord: { root: r(7), quality: "maj" } },
    { roman: "V7", chord: { root: r(7), quality: "7" } },
    { roman: "VI", chord: { root: r(8), quality: "maj" } },
    { roman: "vii°", chord: { root: r(11), quality: "dim" } },
  ];
}
