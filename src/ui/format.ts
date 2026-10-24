import { ALL_KEYS, chordLabel, finnishNoteName, keyDisplayName, spellingsOf, type Chord, type KeyScore, type MusicKey } from "../music";

/** Sävellajin lyhyt nimi valintaruudukkoon: "Fis/Ges", "dis/es" */
export function keyShortName(sound: string): string {
  return spellingsOf(sound)
    .map((k) => (k.mode === "major" ? finnishNoteName(k.tonic) : finnishNoteName(k.tonic).toLowerCase()))
    .join("/");
}

/** Sävellajiarvion (sävelluokka + moodi) nimi yksinkertaisimmalla kirjoitusasulla. */
export function keyScoreName(s: Pick<KeyScore, "pc" | "mode">): string {
  const options = ALL_KEYS.filter((k) => k.pc === s.pc && k.mode === s.mode).sort((a, b) => a.accidentals - b.accidentals);
  return options.length ? keyDisplayName(options[0]) : "?";
}

export const chordText = (c: Chord | null, key: MusicKey): string => (c ? chordLabel(c, key.flats) : "–");

export const PRAISES = ["Hienoa!", "Upeaa!", "Nappiin!", "Bravo!", "Loistavaa!", "Mahtavaa!"];

export function randomPraise(previous: string | null): string {
  const pool = PRAISES.filter((p) => p !== previous);
  return pool[Math.floor(Math.random() * pool.length)];
}
