import { accentFor, beatsPerBar, type Accent, type TimeSignature } from "../music";

export interface MetronomeConfig {
  bpm: number;
  signature: TimeSignature;
  customBeats: number;
  volume: number; // 0–1
}

/** Puukapulan (claves) perustaajuus: tahdin alku hieman korkeampi. */
const CLICK_HZ: Record<Accent, number> = { strong: 2800, medium: 2650, weak: 2500 };
const CLICK_GAIN: Record<Accent, number> = { strong: 1, medium: 0.7, weak: 0.5 };
/** Puun värähtelymuodot: [taajuussuhde, voimakkuus, vaimenemisaika s] */
const WOOD_MODES: [number, number, number][] = [
  [1, 1, 0.012],
  [1.62, 0.45, 0.007],
];
const KNOCK_S = 0.004;

/**
 * Web Audion kelloon ajoitettu metronomi (look-ahead-ajastus).
 * Ääni muistuttaa puukapuloita: kaksi nopeasti vaimenevaa värähtelymuotoa ja lyhyt
 * kohinaisku. Se on lyhyt (≈30 ms) ja analysoitavan sävelalueen (≤ C7) yläpuolella;
 * oikeilla pianonäytteillä kokeiltuna se muutti sointutunnistusta alle 1 %:ssa kehyksistä.
 */
export class Metronome {
  private timer: number | null = null;
  private nextTime = 0;
  private beat = 0;
  private scheduled: { time: number; beat: number }[] = [];
  config: MetronomeConfig;
  private knock: AudioBuffer;

  constructor(
    private ctx: AudioContext,
    config: MetronomeConfig,
  ) {
    this.config = { ...config };
    // Iskun kohina: valkoinen kohina, joka vaimenee lineaarisesti 4 ms:ssa.
    const n = Math.round(KNOCK_S * ctx.sampleRate);
    this.knock = ctx.createBuffer(1, n, ctx.sampleRate);
    const data = this.knock.getChannelData(0);
    for (let i = 0; i < n; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / n);
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
    const peak = this.config.volume * CLICK_GAIN[accent];
    if (peak <= 0) return;
    for (const [ratio, amp, tau] of WOOD_MODES) {
      const osc = new OscillatorNode(this.ctx, { type: "sine", frequency: CLICK_HZ[accent] * ratio });
      const gain = new GainNode(this.ctx, { gain: 0 });
      gain.gain.setValueAtTime(peak * amp * 0.6, time);
      gain.gain.setTargetAtTime(0, time, tau);
      osc.connect(gain).connect(this.ctx.destination);
      osc.start(time);
      osc.stop(time + tau * 8);
    }
    const noise = new AudioBufferSourceNode(this.ctx, { buffer: this.knock });
    const hp = new BiquadFilterNode(this.ctx, { type: "highpass", frequency: 1500 });
    const ng = new GainNode(this.ctx, { gain: peak * 0.35 });
    noise.connect(hp).connect(ng).connect(this.ctx.destination);
    noise.start(time);
  }
}
