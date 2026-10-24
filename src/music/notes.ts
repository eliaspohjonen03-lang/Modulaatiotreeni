import { Note } from "tonal";

/** Sävelluokka 0–11 (C = 0). */
export type PitchClass = number;

const SHARP_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const FLAT_NAMES = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];

export const mod12 = (n: number): number => ((n % 12) + 12) % 12;

/** Kansainvälinen nimi (esim. "F#", "Bb") sävelluokasta. */
export function pcToName(pc: PitchClass, preferFlats = false): string {
  return (preferFlats ? FLAT_NAMES : SHARP_NAMES)[mod12(pc)];
}

/** Sävelluokka kansainvälisestä nimestä ("F#", "Bb", "Cb" …). */
export function nameToPc(name: string): PitchClass {
  const c = Note.chroma(name);
  if (c === undefined || Number.isNaN(c)) throw new Error(`Tuntematon sävel: ${name}`);
  return c;
}

/**
 * Suomalainen sävelnimi: H = B, B = Bb, ylennys -is, alennus -es
 * (Es, As ja B poikkeuksina). Palauttaa ison alkukirjaimen muodon.
 */
export function finnishNoteName(name: string): string {
  const letter = name[0].toUpperCase();
  const acc = name.slice(1);
  const sharps = (acc.match(/#/g) ?? []).length;
  const flats = (acc.match(/b/g) ?? []).length;
  if (sharps > 0) return (letter === "B" ? "H" : letter) + "is".repeat(sharps);
  if (flats > 0) {
    if (letter === "B") return flats === 1 ? "B" : "Heses";
    if (letter === "E" || letter === "A") return letter + "s" + "es".repeat(flats - 1);
    return letter + "es".repeat(flats);
  }
  return letter === "B" ? "H" : letter;
}
