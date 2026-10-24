import { isDominantOf, isTonicOf, type Chord } from "./chords";
import type { MusicKey } from "./keys";

export interface CadenceOptions {
  /** Suurin sallittu tauko (hiljaisuus) V:n ja I:n välillä, ms */
  maxGapMs: number;
}

/**
 * Autenttisen kadenssin tunnistus vakaiden sointujen jonosta:
 * tavoitesävellajin V tai V7, jota seuraa suoraan I (mollissa i).
 * Mikä tahansa muu sointu V:n ja I:n välissä katkaisee kadenssin.
 * Esidominantti (IV, ii, ii7) ei ole pakollinen.
 */
export class CadenceDetector {
  private prev: Chord | null = null;
  private prevEnd: number | null = null;

  constructor(public options: CadenceOptions = { maxGapMs: 1500 }) {}

  reset(): void {
    this.prev = null;
    this.prevEnd = null;
  }

  /**
   * Syötä vakaa sointumuutos. `keySupported` kertoo, onko tavoitesävellaji
   * tukevasti läsnä sävellajiarviossa juuri nyt. Palauttaa true, kun kadenssi täyttyy.
   */
  onChord(chord: Chord | null, time: number, target: MusicKey, keySupported: boolean): boolean {
    if (chord === null) {
      if (this.prev && this.prevEnd === null) this.prevEnd = time;
      return false;
    }
    const gapOk = this.prevEnd === null || time - this.prevEnd <= this.options.maxGapMs;
    const hit = !!this.prev && isDominantOf(this.prev, target) && isTonicOf(chord, target) && gapOk && keySupported;
    this.prev = hit ? null : chord;
    this.prevEnd = null;
    return hit;
  }
}
