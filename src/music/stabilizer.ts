import { chordId, type Chord } from "./chords";

export interface StableChange {
  chord: Chord | null;
  time: number;
}

interface Frame {
  time: number;
  id: string;
  chord: Chord | null;
}

/**
 * Hyväksyy uuden soinnun vasta, kun se on ollut vallitseva vähintään
 * minDurationMs ajan (osuus `agreement` ikkunan kehyksistä). Suodattaa
 * kaiun, ohimenevät sävelet ja yksittäiset virhetunnistukset.
 * null = hiljaisuus / ei tunnistettavaa sointua.
 */
export class ChordStabilizer {
  private frames: Frame[] = [];
  private stableId: string | undefined;
  private stableChord: Chord | null = null;

  constructor(
    public minDurationMs = 400,
    public agreement = 0.75,
  ) {}

  get current(): Chord | null {
    return this.stableChord;
  }

  reset(): void {
    this.frames = [];
    this.stableId = undefined;
    this.stableChord = null;
  }

  push(chord: Chord | null, time: number): StableChange | null {
    this.frames.push({ time, id: chord ? chordId(chord) : "-", chord });
    const windowStart = time - this.minDurationMs;
    // Säilytetään yksi ikkunan alkua vanhempi kehys, jotta ikkunan kattavuus tiedetään.
    while (this.frames.length > 1 && this.frames[1].time <= windowStart) this.frames.shift();
    if (this.frames[0].time > windowStart) return null; // ei vielä riittävästi historiaa

    const inWindow = this.frames.filter((f) => f.time > windowStart);
    if (inWindow.length < 2) return null;
    const counts = new Map<string, number>();
    for (const f of inWindow) counts.set(f.id, (counts.get(f.id) ?? 0) + 1);
    let bestId = "";
    let bestCount = 0;
    for (const [id, n] of counts) if (n > bestCount) [bestId, bestCount] = [id, n];
    if (bestCount / inWindow.length < this.agreement) return null;
    // Uusimman kehyksen täytyy myös olla ehdokas, muuten muutos on jo käynnissä.
    if (inWindow[inWindow.length - 1].id !== bestId) return null;
    if (bestId === this.stableId) return null;

    this.stableId = bestId;
    this.stableChord = inWindow[inWindow.length - 1].chord;
    return { chord: this.stableChord, time };
  }
}
