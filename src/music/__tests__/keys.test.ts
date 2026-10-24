import { describe, expect, it } from "vitest";
import {
  ALL_KEYS, ALL_SOUNDS, DISTANCE_RANGES, fifthsDistance, findKey, keyDisplayName, pickNextKey, SELECTABLE_KEYS, soundId, soundsWithAccidentals,
  spellingsOf, type DistanceLevel, type MusicKey,
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

  it("valittavat sävellajit: 24 soivaa, vähiten etumerkkejä", () => {
    expect(SELECTABLE_KEYS).toHaveLength(24);
    expect(new Set(ALL_SOUNDS).size).toBe(24);
    expect(spellingsOf("major:11").map((k) => k.tonic)).toEqual(["B"]); // H-duuri, ei Ces-duuri
    expect(spellingsOf("major:1").map((k) => k.tonic)).toEqual(["Db"]); // Des-duuri, ei Cis-duuri
    expect(spellingsOf("major:6").map((k) => k.tonic).sort()).toEqual(["F#", "Gb"]);
    expect(spellingsOf("minor:3").map((k) => k.tonic).sort()).toEqual(["D#", "Eb"]);
  });

  it("etumerkkien pikavalinnat", () => {
    const names = (lo: number, hi: number) => soundsWithAccidentals(lo, hi).map((s) => keyDisplayName(SELECTABLE_KEYS.find((k) => k.sound === s)!.key));
    expect(names(0, 2)).toEqual(["C-duuri", "G-duuri", "D-duuri", "B-duuri", "F-duuri", "a-molli", "e-molli", "h-molli", "g-molli", "d-molli"]);
    expect(soundsWithAccidentals(3, 4)).toHaveLength(8);
    expect(soundsWithAccidentals(5, 7)).toHaveLength(6);
  });

  it("etäisyys kvinttiympyrällä", () => {
    const k = (t: string, m: "major" | "minor" = "major") => findKey(t, m);
    expect(fifthsDistance(k("C"), k("A", "minor"))).toBe(0);
    expect(fifthsDistance(k("C"), k("G"))).toBe(1);
    expect(fifthsDistance(k("C"), k("C", "minor"))).toBe(3);
    expect(fifthsDistance(k("C"), k("F#"))).toBe(6);
    expect(fifthsDistance(k("C"), k("Gb"))).toBe(6);
    expect(fifthsDistance(k("B"), k("Db"))).toBe(2); // H (5#) – Des (5b) kiertää ympyrän yli
    expect(fifthsDistance(k("Cb"), k("B"))).toBe(0);
  });
});

describe("seuraavan sävellajin arvonta", () => {
  const combos: DistanceLevel[][] = [["near"], ["medium"], ["far"], ["near", "medium"], ["near", "far"], ["near", "medium", "far"]];

  for (const distances of combos)
    it(`etäisyystasot ${distances.join("+")}: aina sopivan etäinen, kun kaikki sävellajit mukana`, () => {
      const rng = seeded(42);
      const allowed = new Set(distances.flatMap((l) => { const [lo, hi] = DISTANCE_RANGES[l]; return Array.from({ length: hi - lo + 1 }, (_, i) => lo + i); }));
      const seen = new Set<number>();
      let current: MusicKey | null = null;
      const history: MusicKey[] = [];
      for (let i = 0; i < 300; i++) {
        const next = pickNextKey({ sounds: ALL_SOUNDS, distances, current, history, rng });
        if (current) {
          const d = fifthsDistance(current, next);
          expect(allowed.has(d), `etäisyys ${d}`).toBe(true);
          seen.add(d);
          history.push(current);
        }
        current = next;
      }
      // Yhdistelmässä kaikkia tasoja todella arvotaan.
      for (const l of distances) expect([...seen].some((d) => d >= DISTANCE_RANGES[l][0] && d <= DISTANCE_RANGES[l][1])).toBe(true);
    });

  it("vain valitut sävellajit", () => {
    const rng = seeded(9);
    const sounds = soundsWithAccidentals(0, 2).filter((s) => s.startsWith("minor"));
    let current: MusicKey | null = null;
    for (let i = 0; i < 200; i++) {
      const next = pickNextKey({ sounds, distances: [], current, history: [], rng });
      expect(sounds).toContain(soundId(next));
      current = next;
    }
  });

  it("tyhjä valinta = kaikki sävellajit", () => {
    expect(ALL_SOUNDS).toContain(soundId(pickNextKey({ sounds: [], distances: [], current: null, history: [], rng: seeded(1) })));
  });

  it("ei sama kuin nykyinen eikä mikään kolmesta edellisestä (riittävän iso joukko)", () => {
    const rng = seeded(7);
    for (const distances of [[], ["far"]] as DistanceLevel[][]) {
      const seq: MusicKey[] = [];
      let current: MusicKey | null = null;
      for (let i = 0; i < 400; i++) {
        const next = pickNextKey({ sounds: ALL_SOUNDS, distances, current, history: seq.slice(0, -1), rng });
        seq.push(next);
        current = next;
      }
      for (let i = 4; i < seq.length; i++) {
        const prev4 = seq.slice(i - 4, i).map(soundId);
        expect(prev4).not.toContain(soundId(seq[i]));
      }
    }
  });

  it("valituista ei löydy sopivan etäistä: valitaan lähin, ei koskaan nykyistä", () => {
    const rng = seeded(3);
    const sounds = ["major:0", "major:7"]; // C ja G: 1 askel
    let current: MusicKey = findKey("C", "major");
    for (let i = 0; i < 50; i++) {
      const next = pickNextKey({ sounds, distances: ["far"], current, history: [], rng });
      expect(soundId(next)).not.toBe(soundId(current));
      expect(sounds).toContain(soundId(next));
      current = next;
    }
  });

  it("enharmoniset kirjoitusasut lasketaan samaksi (Fis-duuri ≠ Ges-duuri peräkkäin)", () => {
    const rng = seeded(3);
    let current: MusicKey = findKey("F#", "major");
    for (let i = 0; i < 200; i++) {
      const next = pickNextKey({ sounds: soundsWithAccidentals(5, 7), distances: [], current, history: [], rng });
      expect(soundId(next)).not.toBe(soundId(current));
      current = next;
    }
  });

  it("pieni joukko: kierto käy kaikki läpi ilman välitöntä toistoa", () => {
    const rng = seeded(5);
    const sounds = soundsWithAccidentals(3, 4).filter((s) => s.startsWith("major"));
    const session = new PracticeSession({ sounds, distances: [], startKey: "random" }, rng);
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

  it("lähtösävellaji: valittu tai arvottu valituista", () => {
    expect(new PracticeSession({ sounds: ALL_SOUNDS, distances: ["far"], startKey: "major:C" }).target.id).toBe("major:C");
    const sounds = soundsWithAccidentals(3, 4).filter((s) => s.startsWith("minor"));
    const s = new PracticeSession({ sounds, distances: [], startKey: "random" }, seeded(1));
    expect(sounds).toContain(soundId(s.target));
  });
});
