import { accentFor, beatsPerBar, type Accent, type TimeSignature } from "../music";

export interface MetronomeConfig {
  bpm: number;
  signature: TimeSignature;
  customBeats: number;
  volume: number; // 0–1
}

const CLICK_HZ: Record<Accent, number> = { strong: 7500, medium: 6800, weak: 6000 };
const CLICK_GAIN: Record<Accent, number> = { strong: 1, medium: 0.7, weak: 0.5 };

/**
 * Web Audion kelloon ajoitettu metronomi (look-ahead-ajastus).
 * Klikki on lyhyt (≈25 ms) ja korkea, jotta se on helppo suodattaa analyysistä.
 */
export class Metronome {
  private timer: number | null = null;
  private nextTime = 0;
  private beat = 0;
  private scheduled: { time: number; beat: number }[] = [];
  config: MetronomeConfig;

  constructor(
    private ctx: AudioContext,
    config: MetronomeConfig,
  ) {
    this.config = { ...config };
  }

  get running(): boolean {
    return this.timer !== null;
  }

  start(): void {
    if (this.timer !== null) return;
    this.beat = 0;
    this.nextTime = this.ctx.currentTime + 0.1;
    this.timer = window.setInterval(() => this.schedule(), 25);
    this.schedule();
  }

  stop(): void {
    if (this.timer !== null) window.clearInterval(this.timer);
    this.timer = null;
    this.scheduled = [];
  }

  update(config: MetronomeConfig): void {
    this.config = { ...config };
    if (this.beat >= beatsPerBar(config.signature, config.customBeats)) this.beat = 0;
  }

  /** Viimeaikaisten ja tulevien klikkien ajat (AudioContext-aika, s). */
  clickTimes(): number[] {
    return this.scheduled.map((s) => s.time);
  }

  /** Iskun numero (0 = tahdin alku), joka soi parhaillaan, tai null. */
  currentBeat(): number | null {
    const now = this.ctx.currentTime;
    let current: number | null = null;
    for (const s of this.scheduled) if (s.time <= now) current = s.beat;
    return current;
  }

  private schedule(): void {
    const ahead = this.ctx.currentTime + 0.12;
    while (this.nextTime < ahead) {
      this.click(this.nextTime, accentFor(this.beat, this.config.signature));
      this.scheduled.push({ time: this.nextTime, beat: this.beat });
      this.beat = (this.beat + 1) % beatsPerBar(this.config.signature, this.config.customBeats);
      this.nextTime += 60 / this.config.bpm;
    }
    const keepFrom = this.ctx.currentTime - 2;
    this.scheduled = this.scheduled.filter((s) => s.time >= keepFrom);
  }

  private click(time: number, accent: Accent): void {
    const osc = new OscillatorNode(this.ctx, { type: "sine", frequency: CLICK_HZ[accent] });
    const gain = new GainNode(this.ctx, { gain: 0 });
    const peak = Math.max(0.0001, this.config.volume * CLICK_GAIN[accent]);
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(peak, time + 0.001);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.025);
    osc.connect(gain).connect(this.ctx.destination);
    osc.start(time);
    osc.stop(time + 0.03);
  }
}
