import { Key } from "tonal";
import { finnishNoteName, mod12, nameToPc, type PitchClass } from "./notes";

export type Mode = "major" | "minor";
/** Modulaation vaikeus: etäisyys edellisestä sävellajista kvinttiympyrällä */
export type DistanceLevel = "near" | "medium" | "far" | "all";

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
  /** Paikka kvinttiympyrällä: ylennykset positiivisina, alennukset negatiivisina (C = 0, Es = -3) */
  fifths: number;
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
    fifths: alteration,
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

/** Askeleet kvinttiympyrällä (0–6). Rinnakkaissävellajit (C / a) ovat 0 askeleen päässä. */
export function fifthsDistance(a: MusicKey, b: MusicKey): number {
  const d = mod12(a.fifths - b.fifths);
  return Math.min(d, 12 - d);
}

export const DISTANCE_RANGES: Record<DistanceLevel, [number, number]> = {
  near: [0, 1],
  medium: [2, 3],
  far: [4, 6],
  all: [0, 6],
};

/** Valittavat sävellajit soivina (enharmoniset yhdessä), kvinttiympyrän järjestyksessä. */
const CIRCLE_MAJOR = ["C", "G", "D", "A", "E", "B", "F#", "Db", "Ab", "Eb", "Bb", "F"];
const CIRCLE_MINOR = ["A", "E", "B", "F#", "C#", "G#", "Eb", "Bb", "F", "C", "G", "D"];

/** Kirjoitusasu, jota käytetään: vähiten etumerkkejä (Fis/Ges ja dis/es tasoissa → molemmat). */
export function spellingsOf(sound: string): MusicKey[] {
  const all = ALL_KEYS.filter((k) => soundId(k) === sound);
  const min = Math.min(...all.map((k) => k.accidentals));
  return all.filter((k) => k.accidentals === min);
}

/** 24 valittavaa sävellajia: [soundId, näytettävä sävellaji] */
export const SELECTABLE_KEYS: { mode: Mode; sound: string; key: MusicKey }[] = [
  ...CIRCLE_MAJOR.map((t) => findKey(t, "major")),
  ...CIRCLE_MINOR.map((t) => findKey(t, "minor")),
].map((key) => ({ mode: key.mode, sound: soundId(key), key }));

/** Etumerkkimäärän mukaiset pikavalinnat (vähiten etumerkkejä käyttävän kirjoitusasun mukaan). */
export function soundsWithAccidentals(lo: number, hi: number): string[] {
  return SELECTABLE_KEYS.filter((s) => s.key.accidentals >= lo && s.key.accidentals <= hi).map((s) => s.sound);
}

export const ALL_SOUNDS: readonly string[] = SELECTABLE_KEYS.map((s) => s.sound);

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
  /** Mukana olevat sävellajit (soundId); tyhjä = kaikki */
  sounds: readonly string[];
  distance: DistanceLevel;
  /** Nykyinen tavoite (ei saa toistua) */
  current: MusicKey | null;
  /** Aiemmat tavoitteet, uusin viimeisenä */
  history: readonly MusicKey[];
  /** Montako edellistä estetään (oletus 3) */
  avoidLast?: number;
  rng?: () => number;
}

/**
 * Arpoo seuraavan tavoitesävellajin valituista. Ei koskaan sama kuin nykyinen
 * eikä mikään kolmesta edellisestä; jos ehtoa ei voi täyttää, vanhimpia estoja
 * löysätään yksi kerrallaan. Etäisyystaso rajaa ehdokkaat kvinttiympyrän
 * askelten mukaan nykyisestä sävellajista. Jos valituista ei löydy yhtään
 * sopivan etäistä, valitaan lähimpänä tasoa olevat.
 */
export function pickNextKey(opts: PickOptions): MusicKey {
  const rng = opts.rng ?? Math.random;
  const avoidLast = opts.avoidLast ?? 3;
  const chosen = new Set(opts.sounds);
  let pool = ALL_SOUNDS.filter((s) => chosen.has(s));
  if (pool.length === 0) pool = [...ALL_SOUNDS];

  const cur = opts.current;
  const currentId = cur ? soundId(cur) : null;
  const recent = opts.history.slice(-avoidLast).map(soundId);
  const [lo, hi] = DISTANCE_RANGES[opts.distance];
  /** Kuinka monta askelta etäisyystason ulkopuolella (0 = sopii) */
  const penalty = (id: string) => {
    if (!cur) return 0;
    const d = fifthsDistance(cur, spellingsOf(id)[0]);
    return d < lo ? lo - d : d > hi ? d - hi : 0;
  };

  let candidates: string[] = [];
  for (let drop = 0; drop <= recent.length && candidates.length === 0; drop++) {
    const banned = new Set(recent.slice(drop));
    if (currentId) banned.add(currentId);
    candidates = pool.filter((id) => !banned.has(id) && penalty(id) === 0);
  }
  if (candidates.length === 0) {
    // Valituista ei löydy sopivan etäistä: lähimpänä tasoa olevat (nykyinen silti kielletty, jos mahdollista).
    const others = pool.filter((id) => id !== currentId);
    const rest = others.length > 0 ? others : pool;
    const best = Math.min(...rest.map(penalty));
    candidates = rest.filter((id) => penalty(id) === best);
  }

  const spellings = spellingsOf(candidates[Math.floor(rng() * candidates.length)]);
  return spellings[Math.floor(rng() * spellings.length)];
}
