import { Key } from "tonal";
import { finnishNoteName, nameToPc, type PitchClass } from "./notes";

export type Mode = "major" | "minor";
export type Difficulty = "easy" | "medium" | "hard" | "all";
export type ModeFilter = "major" | "minor" | "both";

export interface MusicKey {
  /** Esim. "major:F#" */
  id: string;
  /** Kansainvälinen kirjoitusasu, esim. "F#", "Bb" */
  tonic: string;
  mode: Mode;
  pc: PitchClass;
  /** Etumerkkien määrä (0–7), ylennykset ja alennukset samanarvoisina */
  accidentals: number;
  /** true = alennusetumerkintä */
  flats: boolean;
}

const MAJOR_TONICS = ["C", "G", "D", "A", "E", "B", "F#", "C#", "F", "Bb", "Eb", "Ab", "Db", "Gb", "Cb"];
const MINOR_TONICS = ["A", "E", "B", "F#", "C#", "G#", "D#", "A#", "D", "G", "C", "F", "Bb", "Eb", "Ab"];

function makeKey(tonic: string, mode: Mode): MusicKey {
  const alteration = mode === "major" ? Key.majorKey(tonic).alteration : Key.minorKey(tonic).alteration;
  return {
    id: `${mode}:${tonic}`,
    tonic,
    mode,
    pc: nameToPc(tonic),
    accidentals: Math.abs(alteration),
    flats: alteration < 0,
  };
}

/** Kaikki 30 sävellajia (15 duuria, 15 mollia, enharmoniset kirjoitusasut mukana). */
export const ALL_KEYS: readonly MusicKey[] = [
  ...MAJOR_TONICS.map((t) => makeKey(t, "major")),
  ...MINOR_TONICS.map((t) => makeKey(t, "minor")),
];

export function keyById(id: string): MusicKey | undefined {
  return ALL_KEYS.find((k) => k.id === id);
}

export function findKey(tonic: string, mode: Mode): MusicKey {
  const k = keyById(`${mode}:${tonic}`);
  if (!k) throw new Error(`Tuntematon sävellaji: ${tonic} ${mode}`);
  return k;
}

/** Soiva tunniste: enharmoniset sävellajit (Fis-duuri / Ges-duuri) ovat sama ääni. */
export const soundId = (k: MusicKey): string => `${k.mode}:${k.pc}`;

export const DIFFICULTY_RANGES: Record<Difficulty, [number, number]> = {
  easy: [0, 2],
  medium: [3, 4],
  hard: [5, 7],
  all: [0, 7],
};

export function keysFor(level: Difficulty, modes: ModeFilter): MusicKey[] {
  const [lo, hi] = DIFFICULTY_RANGES[level];
  return ALL_KEYS.filter(
    (k) => k.accidentals >= lo && k.accidentals <= hi && (modes === "both" || k.mode === modes),
  );
}

/** "Fis-duuri", "es-molli", "H-duuri", "b-molli" */
export function keyDisplayName(k: MusicKey): string {
  const name = finnishNoteName(k.tonic);
  return k.mode === "major" ? `${name}-duuri` : `${name.toLowerCase()}-molli`;
}

export function signatureText(k: MusicKey): string {
  if (k.accidentals === 0) return "ei etumerkkejä";
  const word = k.flats ? (k.accidentals === 1 ? "alennus" : "alennusta") : k.accidentals === 1 ? "ylennys" : "ylennystä";
  return `${k.accidentals} ${word}`;
}

export interface PickOptions {
  level: Difficulty;
  modes: ModeFilter;
  /** Nykyinen tavoite (ei saa toistua) */
  current: MusicKey | null;
  /** Aiemmat tavoitteet, uusin viimeisenä */
  history: readonly MusicKey[];
  /** Montako edellistä estetään (oletus 3) */
  avoidLast?: number;
  rng?: () => number;
}

/**
 * Arpoo seuraavan tavoitesävellajin valitun tason joukosta. Ei koskaan sama kuin
 * nykyinen eikä mikään kolmesta edellisestä. Jos joukko on niin pieni, ettei
 * ehtoa voi täyttää (esim. keskitaso + vain duurit = 4 sävellajia), vanhimpia
 * estoja löysätään yksi kerrallaan – nykyinen on silti aina kielletty.
 * Enharmoniset kirjoitusasut lasketaan samaksi sävellajiksi.
 */
export function pickNextKey(opts: PickOptions): MusicKey {
  const rng = opts.rng ?? Math.random;
  const avoidLast = opts.avoidLast ?? 3;
  const pool = keysFor(opts.level, opts.modes);
  if (pool.length === 0) throw new Error("Tyhjä sävellajijoukko");

  const groups = new Map<string, MusicKey[]>();
  for (const k of pool) {
    const g = groups.get(soundId(k)) ?? [];
    g.push(k);
    groups.set(soundId(k), g);
  }

  const currentId = opts.current ? soundId(opts.current) : null;
  const recent = opts.history.slice(-avoidLast).map(soundId);

  let candidates: string[] = [];
  for (let drop = 0; drop <= recent.length; drop++) {
    const banned = new Set(recent.slice(drop));
    if (currentId) banned.add(currentId);
    candidates = [...groups.keys()].filter((id) => !banned.has(id));
    if (candidates.length > 0) break;
  }
  // Vain jos joukossa on ainoastaan nykyinen sävellaji (ei käytännössä mahdollista).
  if (candidates.length === 0) candidates = [...groups.keys()];

  const group = groups.get(candidates[Math.floor(rng() * candidates.length)])!;
  return group[Math.floor(rng() * group.length)];
}
