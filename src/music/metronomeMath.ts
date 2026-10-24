export type TimeSignature = "2/4" | "3/4" | "4/4" | "6/8" | "custom";

export const MIN_BPM = 30;
export const MAX_BPM = 240;

export const clampBpm = (bpm: number): number => Math.round(Math.min(MAX_BPM, Math.max(MIN_BPM, bpm)));

export function beatsPerBar(sig: TimeSignature, customBeats = 4): number {
  switch (sig) {
    case "2/4":
      return 2;
    case "3/4":
      return 3;
    case "4/4":
      return 4;
    case "6/8":
      return 6;
    case "custom":
      return Math.max(1, Math.min(16, Math.round(customBeats)));
  }
}

export type Accent = "strong" | "medium" | "weak";

/** Tahdin 1. isku korostetaan; 6/8:ssa 4. kahdeksasosa saa keskikorostuksen. */
export function accentFor(beatIndex: number, sig: TimeSignature): Accent {
  if (beatIndex === 0) return "strong";
  if (sig === "6/8" && beatIndex === 3) return "medium";
  return "weak";
}

/**
 * Tap tempo: napautusten aikaleimoista (ms) tempo. Käytetään enintään 6 viimeistä
 * napautusta; yli 2 s tauko aloittaa uuden sarjan.
 */
export function tapTempo(taps: readonly number[]): number | null {
  const recent: number[] = [];
  for (let i = taps.length - 1; i >= 0 && recent.length < 6; i--) {
    if (recent.length > 0 && recent[0] - taps[i] > 2000) break;
    recent.unshift(taps[i]);
  }
  if (recent.length < 2) return null;
  const intervals = recent.slice(1).map((t, i) => t - recent[i]);
  const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length;
  return clampBpm(60000 / avg);
}

/**
 * Onko hetki `t` (s) jonkin metronomiklikin maskausikkunan sisällä.
 * Ikkuna: [klikki - preS, klikki + postS].
 */
export function isMasked(t: number, clickTimes: readonly number[], preS: number, postS: number): boolean {
  for (const c of clickTimes) if (t >= c - preS && t <= c + postS) return true;
  return false;
}

/** Klikkien ajat (s) aikavälillä [from, to), kun ensimmäinen isku on hetkellä start. */
export function clickTimesBetween(start: number, bpm: number, from: number, to: number): number[] {
  const interval = 60 / bpm;
  const out: number[] = [];
  let i = Math.max(0, Math.ceil((from - start) / interval - 1e-9));
  for (let t = start + i * interval; t < to; t = start + ++i * interval) out.push(t);
  return out;
}
