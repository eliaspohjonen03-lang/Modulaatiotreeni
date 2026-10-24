import { Key, Note } from "tonal";
import { describe, expect, it } from "vitest";
import { ALL_KEYS, findKey, soundId, type MusicKey } from "../keys";
import { chordNotes, chordPcs, distanceText, dominant7, modulationRoutes, spelledChordLabel, startRoute, type ModulationRoute } from "../modulation";
import { nameToPc } from "../notes";

const k = (t: string, m: "major" | "minor" = "major") => findKey(t, m);
const labels = (r: ModulationRoute) => r.steps.map((s) => spelledChordLabel(s.chord));
const LETTERS = "CDEFGAB";

/** Sointusävelet terssipinona: jokainen seuraava kirjain kaksi askelta ylempänä (esim. Eis–Gis–H–D). */
function stackedInThirds(notes: string[]): boolean {
  return notes.every((n, i) => i === 0 || (LETTERS.indexOf(Note.get(n).letter) - LETTERS.indexOf(Note.get(notes[i - 1]).letter) + 7) % 7 === 2);
}

function scalePcs(key: MusicKey): Set<number> {
  const s = key.mode === "major" ? Key.majorKey(key.tonic).scale : [...Key.minorKey(key.tonic).natural.scale, ...Key.minorKey(key.tonic).harmonic.scale];
  return new Set(s.map(nameToPc));
}

const pairs: [MusicKey, MusicKey][] = [];
for (const a of ALL_KEYS) for (const b of ALL_KEYS) if (soundId(a) !== soundId(b)) pairs.push([a, b]);

describe("modulaatiovinkit: kaikki sävellajiparit", () => {
  it("jokaiselle parille vähintään kaksi reittiä, helpoin ensin", () => {
    for (const [a, b] of pairs) {
      const routes = modulationRoutes(a, b);
      expect(routes.length, `${a.id} → ${b.id}`).toBeGreaterThanOrEqual(2);
      for (let i = 1; i < routes.length; i++) expect(routes[i].rank).toBeGreaterThanOrEqual(routes[i - 1].rank);
      expect(new Set(routes.map((r) => r.technique)).size).toBe(routes.length);
    }
  });

  it("reitti alkaa lähtösävellajin toonikasta ja päättyy tavoitteen V7 → I", () => {
    for (const [a, b] of pairs) {
      for (const r of modulationRoutes(a, b)) {
        const first = r.steps[0].chord;
        expect(nameToPc(first.root), `${a.id} → ${b.id} ${r.technique}`).toBe(a.pc);
        const [v, i] = r.steps.slice(-2).map((s) => s.chord);
        expect(chordPcs(v)).toEqual(chordPcs(dominant7(b).chord));
        expect(v.kind).toBe("7");
        expect(nameToPc(i.root)).toBe(b.pc);
        expect(i.kind).toBe(b.mode === "major" ? "maj" : "min");
      }
    }
  });

  it("kaikki soinnut kirjoitettu terssipinoina (esim. Eis eikä F Fis-duurissa)", () => {
    for (const [a, b] of pairs)
      for (const r of modulationRoutes(a, b))
        for (const s of r.steps) {
          expect(stackedInThirds(chordNotes(s.chord)), `${spelledChordLabel(s.chord)} (${a.id} → ${b.id})`).toBe(true);
          if (s.respelled) expect(stackedInThirds(chordNotes(s.respelled))).toBe(true);
        }
  });

  it("yhteinen sointu kuuluu molempiin sävellajeihin", () => {
    for (const [a, b] of pairs) {
      const r = modulationRoutes(a, b).find((x) => x.technique === "pivot");
      if (!r) continue;
      const pivot = r.steps.find((s) => s.from && s.to)!.chord;
      for (const pc of chordPcs(pivot)) {
        expect(scalePcs(a).has(pc), `${spelledChordLabel(pivot)} ${a.id}`).toBe(true);
        expect(scalePcs(b).has(pc), `${spelledChordLabel(pivot)} ${b.id}`).toBe(true);
      }
    }
  });

  it("vähennetty sointu: uudelleenkirjoitus on tavoitteen johtosävelsointu", () => {
    for (const [a, b] of pairs) {
      const r = modulationRoutes(a, b).find((x) => x.technique === "dim7");
      expect(r, `${a.id} → ${b.id}`).toBeDefined(); // vii°7, vii°7/V ja välijohtosävelsointu kattavat kaikki
      const step = r!.steps[1];
      const target = step.respelled ?? step.chord;
      expect(nameToPc(target.root)).toBe((b.pc + 11) % 12);
      expect(chordPcs(step.chord).sort()).toEqual(chordPcs(target).sort());
    }
  });
});

describe("modulaatiovinkit: tunnetut esimerkit", () => {
  it("C → G: C on G-duurin IV", () => {
    const r = modulationRoutes(k("C"), k("G"))[0];
    expect(r.technique).toBe("pivot");
    expect(labels(r)).toEqual(["C", "D7", "G"]);
    expect(r.steps[0]).toMatchObject({ from: "I", to: "IV" });
  });

  it("C → a: Dm (ii = iv) – E7 – Am", () => {
    expect(labels(modulationRoutes(k("C"), k("A", "minor"))[0])).toEqual(["C", "Dm", "E7", "Am"]);
  });

  it("C → H: napolilainen sointu", () => {
    const r = modulationRoutes(k("C"), k("B"))[0];
    expect(r.technique).toBe("neapolitan");
    expect(labels(r)).toEqual(["C", "Fis7", "H"]);
  });

  it("C → Es: samannimisen c-mollin kautta", () => {
    const r = modulationRoutes(k("C"), k("Eb"))[0];
    expect(r.technique).toBe("parallel");
    expect(labels(r)).toEqual(["C", "Cm", "Fm", "B7", "Es"]);
  });

  it("C → Fis: vähennetty sointu H°7 = Eis°7", () => {
    const r = modulationRoutes(k("C"), k("F#")).find((x) => x.technique === "dim7")!;
    expect(spelledChordLabel(r.steps[1].chord)).toBe("H°7");
    expect(spelledChordLabel(r.steps[1].respelled!)).toBe("Eis°7");
    expect(modulationRoutes(k("C"), k("F#")).some((x) => x.technique === "tritone")).toBe(true);
  });

  it("a → es: Gis°7 = D°7", () => {
    const r = modulationRoutes(k("A", "minor"), k("Eb", "minor")).find((x) => x.technique === "dim7")!;
    expect(spelledChordLabel(r.steps[1].respelled!)).toBe("D°7");
    expect(labels(r).slice(-2)).toEqual(["B7", "Esm"]);
  });

  it("aloitus: I – IV – V7 – I", () => {
    expect(labels(startRoute(k("D", "minor")))).toEqual(["Dm", "Gm", "A7", "Dm"]);
  });

  it("etäisyyden kuvaus", () => {
    expect(distanceText(k("C"), k("A", "minor"))).toMatch(/^Rinnakkaissävellaji/);
    expect(distanceText(k("C"), k("C", "minor"))).toMatch(/^Samanniminen/);
    expect(distanceText(k("C"), k("F#"))).toMatch(/^Tritonus · 6 askelta/);
    expect(distanceText(k("C"), k("G"))).toMatch(/^Lähisävellaji/);
  });
});
