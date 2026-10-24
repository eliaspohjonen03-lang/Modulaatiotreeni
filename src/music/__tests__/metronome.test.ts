import { describe, expect, it } from "vitest";
import { notesToChroma, chordPitchClasses } from "../chords";
import { findKey } from "../keys";
import { accentFor, beatsPerBar, clampBpm, clickTimesBetween, isMasked, tapTempo } from "../metronomeMath";
import { HarmonyTracker } from "../tracker";
import { ch } from "./helpers";

describe("metronomin laskenta", () => {
  it("tahtilajit ja korostukset", () => {
    expect(beatsPerBar("2/4")).toBe(2);
    expect(beatsPerBar("3/4")).toBe(3);
    expect(beatsPerBar("4/4")).toBe(4);
    expect(beatsPerBar("6/8")).toBe(6);
    expect(beatsPerBar("custom", 5)).toBe(5);
    expect(accentFor(0, "3/4")).toBe("strong");
    expect(accentFor(1, "3/4")).toBe("weak");
    expect(accentFor(3, "6/8")).toBe("medium");
    expect(accentFor(3, "4/4")).toBe("weak");
  });

  it("tempo rajataan 30–240", () => {
    expect(clampBpm(10)).toBe(30);
    expect(clampBpm(300)).toBe(240);
    expect(clampBpm(96.4)).toBe(96);
  });

  it("tap tempo", () => {
    expect(tapTempo([0, 500, 1000, 1500])).toBe(120);
    expect(tapTempo([0])).toBeNull();
    // yli 2 s tauko aloittaa uuden sarjan
    expect(tapTempo([0, 1000, 5000, 6000])).toBe(60);
  });

  it.each([30, 60, 97, 240])("klikkien ajat tempolla %s", (bpm) => {
    const times = clickTimesBetween(0, bpm, 0, 10);
    expect(times.length).toBe(Math.ceil((10 * bpm) / 60));
    expect(times[1] - times[0]).toBeCloseTo(60 / bpm, 9);
  });

  it("maskausikkuna klikin ympärillä", () => {
    const clicks = [1, 2];
    expect(isMasked(0.99, clicks, 0.02, 0.1)).toBe(true);
    expect(isMasked(1.05, clicks, 0.02, 0.1)).toBe(true);
    expect(isMasked(1.2, clicks, 0.02, 0.1)).toBe(false);
  });

  it("maskatut kehykset eivät muuta vakaata sointua eivätkä tuota kadenssia", () => {
    const t = new HarmonyTracker(findKey("C", "major"));
    const clicks = clickTimesBetween(0, 120, 0, 10);
    const cChroma = notesToChroma(chordPitchClasses(ch("C")));
    // Klikin kohdalla mikrofoniin tulisi häiriötä (tässä: satunnainen "sointu").
    const noise = notesToChroma(chordPitchClasses(ch("G7")));
    const changes: string[] = [];
    for (let ms = 0; ms < 10000; ms += 50) {
      const s = ms / 1000;
      const masked = isMasked(s, clicks, 0.02, 0.12);
      const frame = s % 0.5 < 0.1 ? noise : cChroma; // häiriö klikin jälkeen
      if (masked) continue; // moottori ohittaa maskatut kehykset kokonaan
      const r = t.process(ms, frame, 0);
      if (r.change) changes.push(String(r.change.chord?.quality));
      expect(r.cadence).toBe(false);
    }
    expect(changes).toEqual(["maj"]);
  });
});
