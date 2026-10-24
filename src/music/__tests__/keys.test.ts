import { describe, expect, it } from "vitest";
import {
  ALL_KEYS, DIFFICULTY_RANGES, findKey, keyDisplayName, keysFor, pickNextKey, soundId, type Difficulty, type ModeFilter, type MusicKey,
} from "../keys";
import { PracticeSession } from "../session";

/** Toistettava pseudosatunnaisgeneraattori */
function seeded(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

describe("sävellajit ja etumerkit", () => {
  it("30 sävellajia", () => {
    expect(ALL_KEYS).toHaveLength(30);
  });

  it("rinnakkaissävellajeilla on sama etumerkintä", () => {
    expect(findKey("A", "major").accidentals).toBe(3);
    expect(findKey("F#", "minor").accidentals).toBe(3);
    expect(findKey("Eb", "major").accidentals).toBe(3);
    expect(findKey("C", "minor").accidentals).toBe(3);
    expect(findKey("Cb", "major").accidentals).toBe(7);
    expect(findKey("Ab", "minor").accidentals).toBe(7);
    expect(findKey("C", "major").accidentals).toBe(0);
    expect(findKey("A", "minor").accidentals).toBe(0);
  });

  it("suomenkieliset nimet: duuri isolla, molli pienellä", () => {
    expect(keyDisplayName(findKey("F#", "major"))).toBe("Fis-duuri");
    expect(keyDisplayName(findKey("Eb", "minor"))).toBe("es-molli");
    expect(keyDisplayName(findKey("B", "major"))).toBe("H-duuri");
    expect(keyDisplayName(findKey("Bb", "minor"))).toBe("b-molli");
    expect(keyDisplayName(findKey("Ab", "major"))).toBe("As-duuri");
    expect(keyDisplayName(findKey("G#", "minor"))).toBe("gis-molli");
  });

  it("tasojen joukot", () => {
    const names = (l: Difficulty, m: ModeFilter) => keysFor(l, m).map((k) => k.tonic).sort();
    expect(names("easy", "major")).toEqual(["Bb", "C", "D", "F", "G"]);
    expect(names("easy", "minor")).toEqual(["A", "B", "D", "E", "G"]);
    expect(names("medium", "major")).toEqual(["A", "Ab", "E", "Eb"]);
    expect(names("medium", "minor")).toEqual(["C", "C#", "F", "F#"]);
    expect(names("hard", "major")).toEqual(["B", "C#", "Cb", "Db", "F#", "Gb"]);
    expect(keysFor("all", "both")).toHaveLength(30);
    expect(keysFor("easy", "both")).toHaveLength(10);
  });
});

describe("seuraavan sävellajin arvonta", () => {
  const levels: Difficulty[] = ["easy", "medium", "hard", "all"];
  const modes: ModeFilter[] = ["major", "minor", "both"];

  for (const level of levels)
    for (const m of modes)
      it(`taso ${level}, ${m}: aina oikean etumerkkimäärän ja moodin joukosta`, () => {
        const rng = seeded(42);
        const [lo, hi] = DIFFICULTY_RANGES[level];
        let current: MusicKey | null = null;
        const history: MusicKey[] = [];
        for (let i = 0; i < 300; i++) {
          const next = pickNextKey({ level, modes: m, current, history, rng });
          expect(next.accidentals).toBeGreaterThanOrEqual(lo);
          expect(next.accidentals).toBeLessThanOrEqual(hi);
          if (m !== "both") expect(next.mode).toBe(m);
          if (current) history.push(current);
          current = next;
        }
      });

  it("ei sama kuin nykyinen eikä mikään kolmesta edellisestä (riittävän iso joukko)", () => {
    const rng = seeded(7);
    for (const [level, m] of [["easy", "both"], ["easy", "major"], ["all", "both"], ["medium", "both"], ["hard", "both"]] as const) {
      const seq: MusicKey[] = [];
      let current: MusicKey | null = null;
      for (let i = 0; i < 400; i++) {
        const next = pickNextKey({ level, modes: m, current, history: seq.slice(0, -1), rng });
        seq.push(next);
        current = next;
      }
      for (let i = 4; i < seq.length; i++) {
        const prev4 = seq.slice(i - 4, i).map(soundId);
        expect(prev4).not.toContain(soundId(seq[i]));
      }
    }
  });

  it("enharmoniset kirjoitusasut lasketaan samaksi (Fis-duuri ≠ Ges-duuri peräkkäin)", () => {
    const rng = seeded(3);
    let current: MusicKey = findKey("F#", "major");
    for (let i = 0; i < 200; i++) {
      const next = pickNextKey({ level: "hard", modes: "major", current, history: [], rng });
      expect(soundId(next)).not.toBe(soundId(current));
      current = next;
    }
  });

  it("pieni joukko: estoja löysätään, mutta nykyinen ei koskaan toistu", () => {
    const rng = seeded(11);
    const session = new PracticeSession({ level: "hard", modes: "minor", startKey: "random" }, rng);
    let prev = session.target;
    for (let i = 0; i < 200; i++) {
      const next = session.advance();
      expect(soundId(next)).not.toBe(soundId(prev));
      expect(next.accidentals).toBeGreaterThanOrEqual(5);
      prev = next;
    }
  });

  it("keskitaso + vain duurit (4 sävellajia): kierto käy kaikki läpi ilman välitöntä toistoa", () => {
    const rng = seeded(5);
    const session = new PracticeSession({ level: "medium", modes: "major", startKey: "random" }, rng);
    const seen = new Set<string>([session.target.id]);
    let prev = session.target;
    for (let i = 0; i < 50; i++) {
      const next = session.advance();
      expect(next.id).not.toBe(prev.id);
      seen.add(next.id);
      prev = next;
    }
    expect(seen.size).toBe(4);
  });

  it("lähtösävellaji: valittu tai arvottu tasolta", () => {
    expect(new PracticeSession({ level: "hard", modes: "both", startKey: "major:C" }).target.id).toBe("major:C");
    const s = new PracticeSession({ level: "medium", modes: "minor", startKey: "random" }, seeded(1));
    expect(s.target.mode).toBe("minor");
    expect([3, 4]).toContain(s.target.accidentals);
  });
});
