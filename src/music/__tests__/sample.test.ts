import { describe, expect, it } from "vitest";
import { chordAsciiLabel, encodeDb, frameMags, replaySample, sampleBinCount, type SampleFile } from "../sample";
import { ch, synthSpectrum } from "./helpers";

/** Synteettinen "tallennus": sama spektri joka kehyksessä, taso laskee `decayDbPerS` verran sekunnissa. */
function synthSample(notes: { midi: number }[], expected: string | null, opts: { seconds?: number; decayDbPerS?: number } = {}): SampleFile {
  const spec = synthSpectrum(notes);
  const bins = sampleBinCount(spec.sampleRate, spec.fftSize);
  const db = Array.from(spec.mags, (m) => 20 * Math.log10(m));
  const frames = [];
  for (let t = 0; t <= (opts.seconds ?? 3) * 1000; t += 50) {
    const level = -25 - ((opts.decayDbPerS ?? 0) * t) / 1000;
    frames.push({ t, level, db: encodeDb(db, bins), instant: null, stable: null });
  }
  return {
    format: "modulaatiotreeni-sample",
    version: 1,
    createdAt: "2026-10-24T12:00:00.000Z",
    meta: { instrument: "piano", registration: "", expected: expected ? ch(expected) : null, notes: "" },
    audio: { sampleRate: spec.sampleRate, fftSize: spec.fftSize, bins },
    settings: { refA: 440, thresholdDb: -50, harmonicSuppression: 0.6, minChordMs: 400 },
    frames,
  };
}

describe("testinäytteet", () => {
  it("dB-koodaus säilyttää spektrin (0,1 dB tarkkuus)", () => {
    const file = synthSample([{ midi: 48 }], null);
    const spec = synthSpectrum([{ midi: 48 }]);
    const mags = frameMags(file, file.frames[0]);
    const k = Math.round(130.81 / (spec.sampleRate / spec.fftSize));
    expect(Math.abs(20 * Math.log10(mags[k] / spec.mags[k]))).toBeLessThan(0.06);
    expect(mags[file.audio.bins + 10]).toBe(0);
  });

  it("uudelleenajo tunnistaa soitetun soinnun", () => {
    const { summary } = replaySample(synthSample([{ midi: 43 }, { midi: 59 }, { midi: 62 }, { midi: 65 }], "G7"));
    expect(summary.stableAfterMs).not.toBeNull();
    expect(summary.stableAfterMs!).toBeLessThan(800);
    expect(summary.framesCorrect / summary.framesAbove).toBeGreaterThan(0.8);
    expect(summary.stableSequence[0]).toMatchObject(ch("G7"));
  });

  it("kynnyksen alle vaimeneva ääni lasketaan hiljaisuudeksi", () => {
    const { summary } = replaySample(synthSample([{ midi: 48 }, { midi: 52 }, { midi: 55 }], "C", { decayDbPerS: 15 }));
    expect(summary.framesAbove).toBeLessThan(45); // -25 dB → -50 dB 1,7 s:ssa
    expect(summary.stableSequence.at(-1)).toBeNull();
  });

  it("tiedostonimen sointunimi", () => {
    expect(chordAsciiLabel(ch("F#m"))).toBe("Fism");
    expect(chordAsciiLabel(ch("Bb7"))).toBe("Bb7");
    expect(chordAsciiLabel(ch("Cdim"))).toBe("Cdim");
  });
});
