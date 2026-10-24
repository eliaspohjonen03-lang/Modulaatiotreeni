import { describe, expect, it } from "vitest";
import {
  chordLabel, chordPitchClasses, detectChord, detectChordFromNotes, diatonicChords, isDominantOf, isTonicOf, QUALITY_INTERVALS, type ChordQuality,
} from "../chords";
import { findKey } from "../keys";
import { ch } from "./helpers";

describe("sointutunnistus", () => {
  const qualities = Object.keys(QUALITY_INTERVALS) as ChordQuality[];
  for (const quality of qualities)
    it(`tunnistaa kaikki ${quality}-soinnut kaikilta pohjasäveliltä`, () => {
      for (let root = 0; root < 12; root++) {
        const m = detectChordFromNotes(chordPitchClasses({ root, quality }), root);
        expect(m).toMatchObject({ root, quality });
      }
    });

  it("käännökset ilman bassotietoa: kolmisoinnut ja septimisoinnut", () => {
    expect(detectChordFromNotes([4, 7, 0])).toMatchObject(ch("C"));
    expect(detectChordFromNotes([11, 2, 5, 7])).toMatchObject(ch("G7"));
    expect(detectChordFromNotes([9, 0, 4])).toMatchObject(ch("Am"));
  });

  it("basso ratkaisee monitulkintaisen tapauksen (Am7 vs. C6)", () => {
    // A C E G: Am7-pohja täsmää täysin
    expect(detectChordFromNotes([9, 0, 4, 7], 9)).toMatchObject(ch("Am7"));
  });

  it("pelkkä kvintti ilman terssiä on monitulkintainen → ei sointua", () => {
    expect(detectChordFromNotes([0, 7])).toBeNull();
  });

  it("hiljaisuus ja kohina eivät tuota sointua", () => {
    expect(detectChord(new Array(12).fill(0))).toBeNull();
    expect(detectChord(new Array(12).fill(1))).toBeNull();
  });

  it("heikko vierassävel ei muuta tunnistusta, voimakas septimi tekee V7:n", () => {
    const c = [1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0.2, 0];
    expect(detectChord(c)).toMatchObject(ch("C"));
    const g7 = [0, 0, 0.9, 0, 0, 0.8, 0, 1, 0, 0, 0, 0.9];
    expect(detectChord(g7, { bass: 7 })).toMatchObject(ch("G7"));
  });

  it("nimet suomalaisittain", () => {
    expect(chordLabel(ch("G7"))).toBe("G7");
    expect(chordLabel(ch("F#m"))).toBe("Fism");
    expect(chordLabel(ch("Bdim"))).toBe("H°");
    expect(chordLabel(ch("Bb"), true)).toBe("B");
  });

  it("sävellajifunktiot duurissa ja mollissa", () => {
    const C = findKey("C", "major");
    const a = findKey("A", "minor");
    expect(isDominantOf(ch("G"), C)).toBe(true);
    expect(isDominantOf(ch("G7"), C)).toBe(true);
    expect(isDominantOf(ch("Gm"), C)).toBe(false);
    expect(isTonicOf(ch("C"), C)).toBe(true);
    expect(isTonicOf(ch("Cm"), C)).toBe(false);
    expect(isDominantOf(ch("E"), a)).toBe(true);
    expect(isDominantOf(ch("E7"), a)).toBe(true);
    expect(isDominantOf(ch("Em"), a)).toBe(false); // johtosävel puuttuu
    expect(isTonicOf(ch("Am"), a)).toBe(true);
    expect(isTonicOf(ch("A"), a)).toBe(false);
  });

  it("testitilan pikanapit", () => {
    const romans = diatonicChords(findKey("D", "major")).map((d) => `${d.roman}=${chordLabel(d.chord)}`);
    expect(romans).toContain("V7=A7");
    expect(romans).toContain("IV=G");
    const minor = diatonicChords(findKey("C", "minor")).map((d) => `${d.roman}=${chordLabel(d.chord, true)}`);
    expect(minor).toContain("V7=G7");
    expect(minor).toContain("VI=As");
  });
});
