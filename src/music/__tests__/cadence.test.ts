import { describe, expect, it } from "vitest";
import { CadenceDetector } from "../cadence";
import { findKey } from "../keys";
import { HarmonyTracker } from "../tracker";
import { ch, play } from "./helpers";

const C = findKey("C", "major");
const a = findKey("A", "minor");

describe("kadenssidetektori (vakaat soinnut)", () => {
  it("V–I ja V7–I hyväksytään, kun sävellaji on tuettu", () => {
    const d = new CadenceDetector();
    expect(d.onChord(ch("G"), 0, C, true)).toBe(false);
    expect(d.onChord(ch("C"), 1000, C, true)).toBe(true);
    expect(d.onChord(ch("G7"), 2000, C, true)).toBe(false);
    expect(d.onChord(ch("C"), 3000, C, true)).toBe(true);
  });

  it("ilman sävellajitukea ei kadenssia", () => {
    const d = new CadenceDetector();
    d.onChord(ch("G7"), 0, C, false);
    expect(d.onChord(ch("C"), 1000, C, false)).toBe(false);
  });

  it("välissä oleva sointu katkaisee, lyhyt tauko ei", () => {
    const d = new CadenceDetector({ maxGapMs: 1500 });
    d.onChord(ch("G7"), 0, C, true);
    d.onChord(ch("Am"), 500, C, true);
    expect(d.onChord(ch("C"), 1000, C, true)).toBe(false);
    d.onChord(ch("G7"), 2000, C, true);
    d.onChord(null, 3000, C, true);
    expect(d.onChord(ch("C"), 3800, C, true)).toBe(true);
    d.onChord(ch("G7"), 5000, C, true);
    d.onChord(null, 6000, C, true);
    expect(d.onChord(ch("C"), 9000, C, true)).toBe(false); // liian pitkä tauko
  });

  it("I–V (puolilopuke) tai V–vi (harhalopuke) ei kelpaa", () => {
    const d = new CadenceDetector();
    d.onChord(ch("C"), 0, C, true);
    expect(d.onChord(ch("G"), 500, C, true)).toBe(false);
    expect(d.onChord(ch("Am"), 1000, C, true)).toBe(false);
  });
});

describe("koko tunnistusketju (testitilan tapaan)", () => {
  it("C–F–G7–C tunnistetaan kadenssiksi C-duurissa", () => {
    const t = new HarmonyTracker(C);
    const r = play(t, ["C", "F", "G7", "C"]);
    expect(r.cadenceAt).toEqual([3]);
  });

  it("esidominantti ei ole pakollinen: C–G–C", () => {
    const t = new HarmonyTracker(C);
    expect(play(t, ["C", "G", "C"]).cadenceAt).toEqual([2]);
  });

  it("molli: am–dm–E7–am hyväksytään", () => {
    const t = new HarmonyTracker(a);
    expect(play(t, ["Am", "Dm", "E7", "Am"]).cadenceAt).toEqual([3]);
  });

  it("molli: am–E–am ja ii°–V–i hyväksytään", () => {
    expect(play(new HarmonyTracker(a), ["Am", "E", "Am"]).cadenceAt).toEqual([2]);
    expect(play(new HarmonyTracker(a), ["Am", "Bdim", "E7", "Am"]).cadenceAt).toEqual([3]);
  });

  it("molli: luonnollinen v (em) ei ole dominantti", () => {
    const t = new HarmonyTracker(a);
    expect(play(t, ["Am", "Dm", "Em", "Am"]).cadenceAt).toEqual([]);
  });

  it("väärä tavoite: C–F–G7–C ei kelpaa, kun tavoite on G-duuri", () => {
    const t = new HarmonyTracker(findKey("G", "major"));
    expect(play(t, ["C", "F", "G7", "C"]).cadenceAt).toEqual([]);
  });

  it("yksittäinen V–I vieraassa ympäristössä ei riitä", () => {
    // Pitkään Es-duurissa, sitten nopea G–C: C-duuri ei ole sävellajiarviossa tukevasti
    const t = new HarmonyTracker(C);
    const r = play(t, ["Eb", "Ab", "Bb7", "Eb", "Cm", "Ab", "Bb7", "Eb", "G", "C"]);
    expect(r.cadenceAt).toEqual([]);
  });

  it("modulaatio: kadenssi C:ssä, sitten uusi tavoite D-duuri ja kadenssi siellä", () => {
    const t = new HarmonyTracker(C);
    const r1 = play(t, ["C", "F", "G7", "C"]);
    expect(r1.cadenceAt).toEqual([3]);
    t.setTarget(findKey("D", "major"));
    const r2 = play(t, ["D", "G", "A7", "D"], r1.time);
    expect(r2.cadenceAt).toEqual([3]);
  });

  it("modulaatio molliin: C-duurista e-molliin", () => {
    const t = new HarmonyTracker(C);
    const r1 = play(t, ["C", "G7", "C"]);
    t.setTarget(findKey("E", "minor"));
    const r2 = play(t, ["Em", "Am", "B7", "Em"], r1.time);
    expect(r2.cadenceAt).toEqual([3]);
  });

  it("kaukainen modulaatio: C-duurista Fis-duuriin, kun uusi sävellaji vakiinnutetaan", () => {
    const t = new HarmonyTracker(C);
    const r1 = play(t, ["C", "G7", "C"]);
    t.setTarget(findKey("F#", "major"));
    const r2 = play(t, ["F#", "B", "C#7", "F#"], r1.time);
    expect(r2.cadenceAt).toEqual([3]);
  });

  it("liian lyhyet soinnut (alle minimikeston) eivät rekisteröidy", () => {
    const t = new HarmonyTracker(C, { minChordMs: 400 });
    const r = play(t, ["C", "F", "G7", "C"], 0, 300);
    expect(r.cadenceAt).toEqual([]);
  });

  it("V–tauko–I hyväksytään lyhyellä tauolla", () => {
    const t = new HarmonyTracker(C);
    const r = play(t, ["C", "F", "G7", "-", "C"], 0, 700);
    expect(r.cadenceAt).toEqual([4]);
  });
});

describe("tonikatila (uusi sävellaji pelkästä tonikasoinnusta)", () => {
  const C = findKey("C", "major");
  const a = findKey("A", "minor");

  it("pelkkä tavoitteen tonika riittää ilman dominanttia", () => {
    expect(play(new HarmonyTracker(C, { successOn: "tonic" }), ["F", "C"]).cadenceAt).toEqual([1]);
    expect(play(new HarmonyTracker(a, { successOn: "tonic" }), ["Am"]).cadenceAt).toEqual([0]);
  });

  it("väärä laatu tai muu sointu ei kelpaa", () => {
    expect(play(new HarmonyTracker(a, { successOn: "tonic" }), ["A", "E7", "Dm"]).cadenceAt).toEqual([]);
  });

  it("tilan vaihto kesken kuuntelun", () => {
    const t = new HarmonyTracker(C);
    expect(play(t, ["F", "C"]).cadenceAt).toEqual([]);
    t.setSuccessOn("tonic");
    t.setTarget(findKey("G", "major"));
    expect(play(t, ["G"], 5000).cadenceAt).toEqual([0]);
  });
});
