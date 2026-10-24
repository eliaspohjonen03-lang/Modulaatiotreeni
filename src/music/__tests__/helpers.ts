import { chordPitchClasses, notesToChroma, type Chord, type ChordQuality } from "../chords";
import { midiToFreq } from "../chroma";
import { nameToPc } from "../notes";
import type { FrameResult, HarmonyTracker } from "../tracker";

/** "G7" → sointu. Pohjasävel kansainvälisellä nimellä, laatu: "", m, 7, dim, maj7, m7 */
export function ch(label: string): Chord {
  const m = label.match(/^([A-G][#b]?)(.*)$/);
  if (!m) throw new Error(label);
  const q: Record<string, ChordQuality> = { "": "maj", m: "min", "7": "7", dim: "dim", maj7: "maj7", m7: "m7" };
  return { root: nameToPc(m[1]), quality: q[m[2]] };
}

export interface PlayResult {
  cadenceAt: number[];
  changes: (Chord | null)[];
  last: FrameResult | null;
  time: number;
}

/**
 * Syöttää sointujonon trackerille 50 ms kehyksinä, kuten testitila tekee.
 * Jokainen sointu soi `durMs`, basso = pohjasävel.
 */
export function play(tracker: HarmonyTracker, labels: string[], startMs = 0, durMs = 1000): PlayResult {
  const res: PlayResult = { cadenceAt: [], changes: [], last: null, time: startMs };
  let t = startMs;
  labels.forEach((label, i) => {
    const chord = label === "-" ? null : ch(label);
    for (let f = 0; f < durMs; f += 50, t += 50) {
      const r = tracker.process(t, chord ? notesToChroma(chordPitchClasses(chord)) : null, chord?.root ?? null);
      if (r.change) res.changes.push(r.change.chord);
      if (r.cadence) res.cadenceAt.push(i);
      res.last = r;
    }
  });
  res.time = t;
  return res;
}

/** Synteettinen magnitudispektri: jokainen sävel harmonisine osasävelineen. */
export function synthSpectrum(
  notes: { midi: number; amp?: number; partials?: number[] }[],
  opts: { sampleRate?: number; fftSize?: number; refA?: number; extra?: { hz: number; amp: number }[] } = {},
) {
  const sampleRate = opts.sampleRate ?? 48000;
  const fftSize = opts.fftSize ?? 16384;
  const binHz = sampleRate / fftSize;
  const mags = new Float32Array(fftSize / 2);
  const addPeak = (hz: number, amp: number) => {
    const c = hz / binHz;
    for (let k = Math.floor(c) - 2; k <= Math.ceil(c) + 2; k++) {
      if (k <= 0 || k >= mags.length) continue;
      mags[k] += amp * Math.max(0, 1 - Math.abs(k - c) / 2);
    }
  };
  for (const n of notes) {
    const f0 = midiToFreq(n.midi, opts.refA ?? 440);
    const partials = n.partials ?? [1, 0.5, 0.33, 0.25, 0.2, 0.16];
    partials.forEach((a, i) => addPeak(f0 * (i + 1), a * (n.amp ?? 1)));
  }
  for (const e of opts.extra ?? []) addPeak(e.hz, e.amp);
  for (let k = 0; k < mags.length; k++) mags[k] += 1e-4; // kohinapohja
  return { mags, sampleRate, fftSize };
}
