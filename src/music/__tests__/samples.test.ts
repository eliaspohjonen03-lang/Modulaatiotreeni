import { describe, expect, it } from "vitest";
import { chordLabel, sameChord } from "../chords";
import { computeChroma } from "../chroma";
import { findKey } from "../keys";
import { frameMags, replaySample, type SampleFile } from "../sample";
import { HarmonyTracker } from "../tracker";
import { loadSampleFiles } from "./sampleFiles";

/**
 * Oikealla soittimella tallennetut näytteet (samples/*.json, ks. Asetukset → Testinäytteet).
 * Jokaisen soinnun pitää tunnistua vakaaksi oletusasetuksilla.
 */
const all = loadSampleFiles();
const samples = all.filter((s) => s.file.meta.expected);

/** Vapaan soiton näytteet, joiden sisältö tiedetään: tiedostonimi → sävellaji ja vakaat soinnut. */
const CADENCES: Record<string, { tonic: string; chords: string[] }> = {
  "2026-10-24_215302_piano_vapaa.json": { tonic: "C", chords: ["C", "F", "G7", "C"] },
  // "Ei yliselkeästi" soitettu: aiemmin oletusasetukset tunnistivat tämän tyyppisen soiton heikosti.
  "2026-10-24_215417_piano_vapaa.json": { tonic: "D", chords: ["D", "E7", "A7", "D"] },
};
const cadences = all.filter((s) => s.name in CADENCES);
const silences = all.filter((s) => !s.file.meta.expected && /hiljaisuus/i.test(s.file.meta.notes));

/** Ajaa kadenssinäytteen trackerille tavoitesävellajissa (oletusasetukset, tallennuksen viritys ja kynnys). */
function playCadence(file: SampleFile, tonic: string) {
  const tracker = new HarmonyTracker(findKey(tonic, "major"));
  const chords: string[] = [];
  /** Vakaa tila jokaisen muutoksen jälkeen, myös "–" (ei sointua) */
  const states: string[] = [];
  let cadences = 0;
  for (const f of file.frames) {
    let chroma: number[] | null = null;
    let bass = null;
    if (f.level >= file.settings.thresholdDb) {
      const r = computeChroma(frameMags(file, f), file.audio.sampleRate, file.audio.fftSize, { refA: file.settings.refA });
      if (r.chroma.some((v) => v > 0)) [chroma, bass] = [r.chroma, r.bass];
    }
    const res = tracker.process(f.t, chroma, bass);
    if (res.change) states.push(res.change.chord ? chordLabel(res.change.chord) : "–");
    if (res.change?.chord) chords.push(chordLabel(res.change.chord));
    if (res.cadence) cadences++;
  }
  return { chords, states, cadences };
}

describe("oikeat testinäytteet", () => {
  it.skipIf(samples.length > 0)("ei näytteitä vielä", () => {});

  it.each(samples.map((s) => [s.name, s.file] as const))("%s", (_name, file) => {
    // Oletusasetukset, ei tallennushetken säätöjä: testataan sovelluksen oletuskäytöstä.
    const { summary } = replaySample(file, { defaults: true });
    const expected = file.meta.expected!;
    expect(summary.framesAbove, "ääni kynnyksen yläpuolella").toBeGreaterThan(0);
    expect(summary.stableAfterMs, `${chordLabel(expected)} vakaaksi`).not.toBeNull();
    // Väärää vakaata sointua ei saa näkyä ennen oikeaa.
    const firstChord = summary.stableSequence.find((c) => c !== null) ?? null;
    expect(sameChord(firstChord, expected), "ensimmäinen vakaa sointu").toBe(true);
  });

  it.each(cadences.map((s) => [s.name, s.file] as const))("kadenssi %s", (name, file) => {
    const { tonic, chords } = CADENCES[name];
    const res = playCadence(file, tonic);
    expect(res.chords).toEqual(chords);
    expect(res.cadences).toBe(1);
    // Sointu ei saa pudota pois sointujen välissä pianon vaimetessa.
    const inner = res.states.slice(res.states.indexOf(chords[0]), res.states.lastIndexOf(chords.at(-1)!) + 1);
    expect(inner).toEqual(chords);
  });

  it.each(silences.map((s) => [s.name, s.file] as const))("hiljaisuus %s", (_name, file) => {
    expect(replaySample(file, { defaults: true }).summary.stableSequence.filter((c) => c !== null)).toEqual([]);
  });
});
