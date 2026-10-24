import {
  computeChroma, encodeDb, estimateFundamental, HarmonyTracker, isMasked, median, notesToChroma, refAFromNote, sampleBinCount,
  sampleChordId, type Chord, type ChordMatch, type KeyScore, type KeySupport, type MusicKey, type PitchClass, type SampleFile,
  type SampleMeta,
} from "../music";
import type { Settings } from "../settings";
import { Metronome } from "./metronome";
import { MicInput } from "./micInput";
import { playSuccess } from "./sounds";

export interface EngineSnapshot {
  running: boolean;
  micOpen: boolean;
  levelDb: number;
  aboveThreshold: boolean;
  instant: ChordMatch | null;
  stable: Chord | null;
  support: KeySupport | null;
  topKeys: KeyScore[];
  beat: number | null;
  masked: boolean;
  error: string | null;
}

export interface TestInput {
  pcs: PitchClass[];
  bass: PitchClass | null;
}

const TICK_MS = 50;

/**
 * Selainpuolen moottori: mikrofoni / testitila → HarmonyTracker, metronomi,
 * äänimerkki. Ei React-riippuvuutta; käyttöliittymä tilaa tilannekuvia.
 */
export class PracticeEngine {
  private ctx: AudioContext | null = null;
  private mic: MicInput | null = null;
  private metronome: Metronome | null = null;
  private timer: number | null = null;
  private tracker: HarmonyTracker;
  private frozenUntil = 0;
  private listeners = new Set<(s: EngineSnapshot) => void>();
  private calibrationSink: ((f: number) => void) | null = null;
  private recording: { file: SampleFile; start: number; until: number; done: (f: SampleFile) => void } | null = null;
  testInput: TestInput | null = null;
  onCadence: (() => void) | null = null;

  snapshot: EngineSnapshot = {
    running: false, micOpen: false, levelDb: -120, aboveThreshold: false, instant: null, stable: null,
    support: null, topKeys: [], beat: null, masked: false, error: null,
  };

  constructor(
    private settings: Settings,
    target: MusicKey,
  ) {
    this.tracker = new HarmonyTracker(target, { minChordMs: settings.minChordMs });
  }

  subscribe(fn: (s: EngineSnapshot) => void): () => void {
    this.listeners.add(fn);
    fn(this.snapshot);
    return () => this.listeners.delete(fn);
  }

  /** Käynnistys käyttäjän napautuksesta (selaimet vaativat sen äänelle). */
  async start(): Promise<void> {
    if (!this.ctx) this.ctx = new AudioContext({ latencyHint: "interactive" });
    if (this.ctx.state !== "running") await this.ctx.resume();
    this.snapshot.error = null;
    await this.syncMic();
    this.syncMetronome();
    if (this.timer === null) this.timer = window.setInterval(() => this.tick(), TICK_MS);
    this.snapshot.running = true;
    this.emit();
  }

  stop(): void {
    if (this.timer !== null) window.clearInterval(this.timer);
    this.timer = null;
    if (this.recording) {
      // Keskeytetty tallennus palautetaan siihen asti kerättynä.
      const rec = this.recording;
      this.recording = null;
      rec.done(rec.file);
    }
    this.mic?.close();
    this.mic = null;
    this.metronome?.stop();
    this.tracker.reset();
    this.snapshot = { ...this.snapshot, running: false, micOpen: false, levelDb: -120, aboveThreshold: false, beat: null };
    this.emit();
  }

  get running(): boolean {
    return this.timer !== null;
  }

  async applySettings(s: Settings): Promise<void> {
    this.settings = s;
    this.tracker.setMinChordMs(s.minChordMs);
    if (this.running) {
      await this.syncMic();
      this.syncMetronome();
    }
  }

  setTarget(key: MusicKey): void {
    this.tracker.setTarget(key);
  }

  /** Ohittaa syötteen hetken (kehu + äänimerkki eivät saa sotkea tunnistusta). */
  freeze(ms: number): void {
    this.frozenUntil = performance.now() + ms;
  }

  success(): void {
    if (this.settings.beep && this.ctx) playSuccess(this.ctx);
  }

  /**
   * Automaattinen vireen kalibrointi: kuunnellaan `durationMs` ja otetaan
   * perustaajuuksien mediaani niistä kehyksistä, joissa taso ylittää kynnyksen.
   */
  async calibrate(durationMs = 3000): Promise<{ refA: number | null; freq: number | null; samples: number }> {
    if (this.settings.testMode) throw new Error("Kalibrointi vaatii mikrofonin (testitila pois).");
    if (!this.running) await this.start();
    const freqs: number[] = [];
    this.calibrationSink = (f) => freqs.push(f);
    await new Promise((r) => window.setTimeout(r, durationMs));
    this.calibrationSink = null;
    if (freqs.length < 5) return { refA: null, freq: null, samples: freqs.length };
    // Hylätään oktaavi- ja kvinttivirheet: pidetään mediaanin lähellä olevat arvot.
    const m = median(freqs);
    const close = freqs.filter((f) => Math.abs(1200 * Math.log2(f / m)) < 30);
    const freq = median(close);
    return { refA: refAFromNote(freq, this.settings.calibrationPc), freq, samples: close.length };
  }

  /** Tallentaa mikrofonin spektrikehykset `durationMs` ajan testinäytteeksi. */
  async record(meta: SampleMeta, durationMs: number): Promise<SampleFile> {
    if (this.settings.testMode) throw new Error("Näytteen tallennus vaatii mikrofonin (testitila pois).");
    if (this.recording) throw new Error("Tallennus on jo käynnissä.");
    if (!this.running) await this.start();
    const mic = this.mic;
    if (!mic) throw new Error(this.snapshot.error ?? "Mikrofoni ei ole käytössä.");
    const s = this.settings;
    const file: SampleFile = {
      format: "modulaatiotreeni-sample",
      version: 1,
      createdAt: new Date().toISOString(),
      meta,
      audio: { sampleRate: mic.sampleRate, fftSize: mic.fftSize, bins: sampleBinCount(mic.sampleRate, mic.fftSize) },
      settings: { refA: s.refA, thresholdDb: s.thresholdDb, harmonicSuppression: s.harmonicSuppression, minChordMs: s.minChordMs },
      frames: [],
    };
    const start = performance.now();
    return new Promise((done) => {
      this.recording = { file, start, until: start + durationMs, done };
    });
  }

  get isRecording(): boolean {
    return this.recording !== null;
  }

  private recordFrame(now: number, levelDb: number): void {
    const rec = this.recording;
    if (!rec || !this.mic) return;
    rec.file.frames.push({
      t: Math.round(now - rec.start),
      level: Math.round(levelDb * 10) / 10,
      db: encodeDb(this.mic.freqDb, rec.file.audio.bins),
      instant: sampleChordId(this.snapshot.instant),
      stable: sampleChordId(this.snapshot.stable),
    });
    if (now >= rec.until) {
      this.recording = null;
      rec.done(rec.file);
    }
  }

  private async syncMic(): Promise<void> {
    if (!this.ctx) return;
    const wantMic = !this.settings.testMode;
    if (wantMic && !this.mic) {
      try {
        this.mic = await MicInput.open(this.ctx);
      } catch (e) {
        this.snapshot.error = `Mikrofonia ei saatu käyttöön: ${(e as Error).message}`;
      }
    } else if (!wantMic && this.mic) {
      this.mic.close();
      this.mic = null;
    }
    this.snapshot.micOpen = !!this.mic;
  }

  private syncMetronome(): void {
    if (!this.ctx) return;
    const s = this.settings;
    const cfg = { bpm: s.bpm, signature: s.signature, customBeats: s.customBeats, volume: s.metronomeVolume };
    if (!this.metronome) this.metronome = new Metronome(this.ctx, cfg);
    else this.metronome.update(cfg);
    if (s.metronomeOn) this.metronome.start();
    else this.metronome.stop();
  }

  private isClickMasked(): boolean {
    if (!this.ctx || !this.metronome?.running) return false;
    // Klikki kulkee kaiuttimesta mikrofoniin viiveellä.
    const latency = (this.ctx.outputLatency || 0) + (this.ctx.baseLatency || 0) + 0.02;
    return isMasked(this.ctx.currentTime - latency, this.metronome.clickTimes(), 0.02, this.settings.clickMaskMs / 1000);
  }

  private tick(): void {
    const now = performance.now();
    const s = this.settings;
    let chroma: number[] | null = null;
    let bass: PitchClass | null = null;
    let levelDb = -120;

    if (s.testMode) {
      if (this.testInput && this.testInput.pcs.length > 0) {
        chroma = notesToChroma(this.testInput.pcs);
        bass = this.testInput.bass;
        levelDb = -20;
      }
    } else if (this.mic) {
      levelDb = this.mic.read();
      if (levelDb >= s.thresholdDb) {
        const r = computeChroma(this.mic.mags, this.mic.sampleRate, this.mic.fftSize, {
          refA: s.refA,
          harmonicSuppression: s.harmonicSuppression,
        });
        if (r.chroma.some((v) => v > 0)) {
          chroma = r.chroma;
          bass = r.bass;
        }
        if (this.calibrationSink) {
          const f = estimateFundamental(this.mic.mags, this.mic.sampleRate, this.mic.fftSize);
          if (f) this.calibrationSink(f);
        }
      }
    }

    const masked = this.isClickMasked();
    const frozen = now < this.frozenUntil;
    let result = null;
    if (!masked && !frozen) {
      result = this.tracker.process(now, chroma, bass);
      if (result.cadence) this.onCadence?.();
    }

    this.snapshot = {
      ...this.snapshot,
      levelDb,
      aboveThreshold: levelDb >= s.thresholdDb,
      instant: result ? result.instant : this.snapshot.instant,
      stable: result ? result.stable : this.snapshot.stable,
      support: result ? result.support : this.snapshot.support,
      topKeys: s.showDiagnostics || s.testMode ? this.tracker.keys.ranking().slice(0, 3) : [],
      beat: this.metronome?.running ? this.metronome.currentBeat() : null,
      masked,
    };
    if (this.recording) this.recordFrame(now, levelDb);
    this.emit();
  }

  private emit(): void {
    for (const fn of this.listeners) fn(this.snapshot);
  }
}
