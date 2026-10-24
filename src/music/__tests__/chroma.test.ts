import { describe, expect, it } from "vitest";
import { detectChord } from "../chords";
import { computeChroma, suppressHarmonics, ChromaSmoother } from "../chroma";
import { estimateFundamental, refAFromNote } from "../tuning";
import { ch, synthSpectrum } from "./helpers";

const ORGAN_MIXTURE = [1, 0.8, 1.1, 0.7, 0.6, 0.8, 0.2, 0.4]; // voimakas 3. ja 6. osasävel

describe("kromagrammi spektristä", () => {
  it("C-duurisointu harmonisine osasävelineen tunnistetaan, basso C", () => {
    const { mags, sampleRate, fftSize } = synthSpectrum([{ midi: 48 }, { midi: 52 }, { midi: 55 }, { midi: 60 }]);
    const r = computeChroma(mags, sampleRate, fftSize);
    expect(r.bass).toBe(0);
    expect(detectChord(r.chroma, { bass: r.bass })).toMatchObject(ch("C"));
  });

  it("urkujen mikstuura: yksittäisen C:n kvintti-yläsävel vaimennetaan", () => {
    const { mags, sampleRate, fftSize } = synthSpectrum([{ midi: 48, partials: ORGAN_MIXTURE }]);
    const raw = computeChroma(mags, sampleRate, fftSize, { harmonicSuppression: 0 });
    const clean = computeChroma(mags, sampleRate, fftSize, { harmonicSuppression: 0.8 });
    expect(raw.chroma[7]).toBeGreaterThan(0.5); // G näkyy ilman vaimennusta
    expect(clean.chroma[7]).toBeLessThan(raw.chroma[7] * 0.5);
  });

  it("G7 jalkiöbassolla ja mikstuurilla: oikea sointu ja basso", () => {
    const { mags, sampleRate, fftSize } = synthSpectrum([
      { midi: 31, partials: [0.3, 1, 0.6, 0.5] }, // 16' G1: perussävel heikko
      { midi: 55, partials: ORGAN_MIXTURE },
      { midi: 59, partials: ORGAN_MIXTURE },
      { midi: 62, partials: ORGAN_MIXTURE },
      { midi: 65, partials: ORGAN_MIXTURE },
    ]);
    const r = computeChroma(mags, sampleRate, fftSize);
    expect(r.bass).toBe(7);
    expect(detectChord(r.chroma, { bass: r.bass })).toMatchObject(ch("G7"));
  });

  it("viritys: A = 415 Hz -soitin tunnistetaan oikein, kun viritys on asetettu", () => {
    const spec = synthSpectrum([{ midi: 57 }, { midi: 61 }, { midi: 64 }], { refA: 415 });
    const wrong = computeChroma(spec.mags, spec.sampleRate, spec.fftSize, { refA: 440 });
    const right = computeChroma(spec.mags, spec.sampleRate, spec.fftSize, { refA: 415 });
    expect(detectChord(right.chroma, { bass: right.bass })).toMatchObject(ch("A"));
    expect(detectChord(wrong.chroma, { bass: wrong.bass })).not.toMatchObject(ch("A"));
  });

  it("korkea metronomiklikki (6–7 kHz) ei näy kromagrammissa", () => {
    const { mags, sampleRate, fftSize } = synthSpectrum([], { extra: [{ hz: 6000, amp: 5 }, { hz: 7500, amp: 5 }] });
    const r = computeChroma(mags, sampleRate, fftSize);
    expect(detectChord(r.chroma)).toBeNull();
  });

  it("oktaaviyläsäveliä ei vähennetä", () => {
    const notes = new Array(40).fill(0);
    notes[0] = 1;
    notes[12] = 0.8;
    expect(suppressHarmonics(notes, 1)[12]).toBe(0.8);
  });

  it("ajallinen tasoitus vaimentaa äkillisen muutoksen", () => {
    const s = new ChromaSmoother(150);
    s.push([1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], 0);
    const after = s.push([0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], 50);
    expect(after[0]).toBeGreaterThan(after[1]);
  });
});

describe("vireen kalibrointi", () => {
  it.each([415, 430, 440, 443, 446])("A = %s Hz", (ref) => {
    const spec = synthSpectrum([{ midi: 57 }], { refA: ref }); // A3
    const f = estimateFundamental(spec.mags, spec.sampleRate, spec.fftSize)!;
    expect(Math.abs(f - ref / 2)).toBeLessThan(0.5);
    expect(Math.abs(refAFromNote(f, 9)! - ref)).toBeLessThan(1);
  });

  it("muu sävel kuin A: valittu sävelluokka huomioidaan", () => {
    const spec = synthSpectrum([{ midi: 60 }], { refA: 442 }); // C4
    const f = estimateFundamental(spec.mags, spec.sampleRate, spec.fftSize)!;
    expect(Math.abs(refAFromNote(f, 0)! - 442)).toBeLessThan(1);
  });

  it("perussävel löytyy, vaikka 2. osasävel on voimakkain", () => {
    const spec = synthSpectrum([{ midi: 45, partials: [0.4, 1, 0.7, 0.5] }]);
    const f = estimateFundamental(spec.mags, spec.sampleRate, spec.fftSize)!;
    expect(Math.abs(f - 110)).toBeLessThan(0.5);
  });

  it("väärä sävel (esim. E soitettuna A:n sijaan) hylätään", () => {
    expect(refAFromNote(329.6, 9)).toBeNull();
  });
});
