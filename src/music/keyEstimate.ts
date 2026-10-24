import type { Mode, MusicKey } from "./keys";
import type { PitchClass } from "./notes";

// Krumhansl–Kesslerin sävellajiprofiilit (Krumhansl–Schmucklerin algoritmi).
export const MAJOR_PROFILE = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
export const MINOR_PROFILE = [6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];

export interface KeyScore {
  pc: PitchClass;
  mode: Mode;
  r: number;
}

function pearson(a: ArrayLike<number>, b: ArrayLike<number>, rot: number): number {
  let ma = 0;
  let mb = 0;
  for (let i = 0; i < 12; i++) {
    ma += a[i];
    mb += b[i];
  }
  ma /= 12;
  mb /= 12;
  let num = 0;
  let da = 0;
  let db = 0;
  for (let i = 0; i < 12; i++) {
    const x = a[(i + rot) % 12] - ma;
    const y = b[i] - mb;
    num += x * y;
    da += x * x;
    db += y * y;
  }
  const den = Math.sqrt(da * db);
  return den === 0 ? 0 : num / den;
}

/** Korrelaatio kaikkiin 24 sävellajiin, paras ensin. */
export function rankKeys(histogram: ArrayLike<number>): KeyScore[] {
  const out: KeyScore[] = [];
  for (let pc = 0; pc < 12; pc++) {
    out.push({ pc, mode: "major", r: pearson(histogram, MAJOR_PROFILE, pc) });
    out.push({ pc, mode: "minor", r: pearson(histogram, MINOR_PROFILE, pc) });
  }
  return out.sort((a, b) => b.r - a.r);
}

export interface KeySupportOptions {
  /** Tavoitesävellajin korrelaation vähimmäisarvo */
  minCorrelation: number;
  /** Kuinka paljon tavoite saa jäädä parhaasta sävellajista */
  maxBehindBest: number;
}

export const DEFAULT_KEY_SUPPORT: KeySupportOptions = { minCorrelation: 0.5, maxBehindBest: 0.15 };

export interface KeySupport {
  ok: boolean;
  r: number;
  best: KeyScore | null;
  rank: number;
}

/**
 * Liukuvan ikkunan sävellajiarvio: sävelluokkahistogrammi, jonka vanhat
 * havainnot vaimenevat eksponentiaalisesti (puoliintumisaika).
 */
export class KeyEstimator {
  private hist = new Array<number>(12).fill(0);
  private lastTime: number | null = null;

  constructor(public halfLifeMs = 8000) {}

  reset(): void {
    this.hist.fill(0);
    this.lastTime = null;
  }

  /** Lisää kromagrammin (mikä tahansa skaala) painolla durationMs hetkellä timeMs. */
  add(chroma: ArrayLike<number>, durationMs: number, timeMs: number): void {
    this.decayTo(timeMs);
    let sum = 0;
    for (let i = 0; i < 12; i++) sum += chroma[i];
    if (sum <= 0) return;
    for (let i = 0; i < 12; i++) this.hist[i] += (chroma[i] / sum) * durationMs;
  }

  decayTo(timeMs: number): void {
    if (this.lastTime !== null && timeMs > this.lastTime) {
      const f = Math.pow(0.5, (timeMs - this.lastTime) / this.halfLifeMs);
      for (let i = 0; i < 12; i++) this.hist[i] *= f;
    }
    if (this.lastTime === null || timeMs > this.lastTime) this.lastTime = timeMs;
  }

  histogram(): number[] {
    return [...this.hist];
  }

  ranking(): KeyScore[] {
    return rankKeys(this.hist);
  }

  support(key: Pick<MusicKey, "pc" | "mode">, opts: KeySupportOptions = DEFAULT_KEY_SUPPORT): KeySupport {
    if (this.hist.every((v) => v === 0)) return { ok: false, r: 0, best: null, rank: -1 };
    const ranking = this.ranking();
    const rank = ranking.findIndex((s) => s.pc === key.pc && s.mode === key.mode);
    const r = ranking[rank].r;
    const best = ranking[0];
    return { ok: r >= opts.minCorrelation && best.r - r <= opts.maxBehindBest, r, best, rank };
  }
}
