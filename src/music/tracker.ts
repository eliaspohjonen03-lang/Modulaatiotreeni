import { CadenceDetector } from "./cadence";
import { detectChord, isTonicOf, type Chord, type ChordMatch } from "./chords";
import { ChromaSmoother } from "./chroma";
import { DEFAULT_KEY_SUPPORT, KeyEstimator, type KeySupport, type KeySupportOptions } from "./keyEstimate";
import type { MusicKey } from "./keys";
import type { PitchClass } from "./notes";
import { ChordStabilizer, type StableChange } from "./stabilizer";

/** Milloin tavoite täyttyy: kadenssi V(7) → I vai pelkkä tavoitesävellajin tonikasointu. */
export type SuccessMode = "cadence" | "tonic";

export interface TrackerOptions {
  successOn: SuccessMode;
  minChordMs: number;
  agreement: number;
  smoothingMs: number;
  keyHalfLifeMs: number;
  maxGapMs: number;
  /** Jos V–I on soitettu mutta sävellajiarvio ei vielä tue tavoitetta, odotetaan
   *  tämän ajan (I:n soidessa edelleen), ehtiikö tuki vakiintua. */
  keyGraceMs: number;
  minChordScore: number;
  keySupport: KeySupportOptions;
}

export const DEFAULT_TRACKER_OPTIONS: TrackerOptions = {
  successOn: "cadence",
  minChordMs: 400,
  agreement: 0.75,
  smoothingMs: 120,
  keyHalfLifeMs: 8000,
  maxGapMs: 1500,
  keyGraceMs: 1500,
  minChordScore: 0.78,
  keySupport: DEFAULT_KEY_SUPPORT,
};

export interface FrameResult {
  /** Tämän kehyksen (tasoitettu) tunnistus */
  instant: ChordMatch | null;
  /** Vakaa sointu */
  stable: Chord | null;
  change: StableChange | null;
  /** Tavoite täyttyi (kadenssi, tai tonikatilassa vakaa tonikasointu) */
  cadence: boolean;
  support: KeySupport;
}

/**
 * Koko tunnistusketju ilman käyttöliittymä- tai selainriippuvuuksia:
 * kromagrammikehys → tasoitus → sointutunnistus → vakautus →
 * sävellajiarvio + kadenssin tunnistus tavoitesävellajissa.
 */
export class HarmonyTracker {
  readonly options: TrackerOptions;
  private smoother: ChromaSmoother;
  private stabilizer: ChordStabilizer;
  readonly keys: KeyEstimator;
  private cadence: CadenceDetector;
  private lastTime: number | null = null;
  private pendingUntil: number | null = null;

  constructor(
    public target: MusicKey,
    options: Partial<TrackerOptions> = {},
  ) {
    this.options = { ...DEFAULT_TRACKER_OPTIONS, ...options };
    this.smoother = new ChromaSmoother(this.options.smoothingMs);
    this.stabilizer = new ChordStabilizer(this.options.minChordMs, this.options.agreement);
    this.keys = new KeyEstimator(this.options.keyHalfLifeMs);
    this.cadence = new CadenceDetector({ maxGapMs: this.options.maxGapMs });
  }

  setMinChordMs(ms: number): void {
    this.options.minChordMs = ms;
    this.stabilizer.minDurationMs = ms;
  }

  setSuccessOn(mode: SuccessMode): void {
    this.options.successOn = mode;
    this.cadence.reset();
    this.pendingUntil = null;
  }

  /** Uusi tavoite: kadenssin tila nollataan, sävellajihistoria säilyy. */
  setTarget(key: MusicKey): void {
    this.target = key;
    this.cadence.reset();
    this.stabilizer.reset();
    this.pendingUntil = null;
  }

  reset(): void {
    this.smoother.reset();
    this.stabilizer.reset();
    this.keys.reset();
    this.cadence.reset();
    this.lastTime = null;
    this.pendingUntil = null;
  }

  /** chroma = null tarkoittaa hiljaisuutta (taso alle kynnyksen). */
  process(time: number, chroma: ArrayLike<number> | null, bass: PitchClass | null = null): FrameResult {
    const dt = this.lastTime === null ? 0 : Math.min(250, Math.max(0, time - this.lastTime));
    this.lastTime = time;

    const smooth = this.smoother.push(chroma, time);
    const instant = chroma ? detectChord(smooth, { bass, minScore: this.options.minChordScore }) : null;
    if (chroma) this.keys.add(chroma, dt, time);
    else this.keys.decayTo(time);

    const change = this.stabilizer.push(instant ? { root: instant.root, quality: instant.quality } : null, time);
    const support = this.keys.support(this.target, this.options.keySupport);
    let cadence = false;
    if (this.options.successOn === "tonic") {
      cadence = !!change?.chord && isTonicOf(change.chord, this.target);
    } else if (change) {
      this.pendingUntil = null;
      // Rakenne (V–I) tarkistetaan ensin, sävellajituki sen jälkeen.
      if (this.cadence.onChord(change.chord, time, this.target, true)) {
        if (support.ok) cadence = true;
        else this.pendingUntil = time + this.options.keyGraceMs;
      }
    } else if (this.pendingUntil !== null) {
      if (time > this.pendingUntil) this.pendingUntil = null;
      else if (support.ok) {
        cadence = true;
        this.pendingUntil = null;
      }
    }
    return { instant, stable: this.stabilizer.current, change, cadence, support };
  }
}
