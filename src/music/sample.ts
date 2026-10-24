import { chordId, sameChord, type Chord, type ChordMatch, type ChordQuality } from "./chords";
import { computeChroma, DEFAULT_CHROMA_OPTIONS, type ChromaOptions } from "./chroma";
import { pcToName, type PitchClass } from "./notes";
import { DEFAULT_TRACKER_OPTIONS, HarmonyTracker, type TrackerOptions } from "./tracker";
import { ALL_KEYS, type MusicKey } from "./keys";

/**
 * Testinäyte: oikealla soittimella mikrofonista tallennetut spektrikehykset
 * ja tieto siitä, mitä soitettiin. Näytteistä tehdään yksikkötestejä ja
 * niillä säädetään tunnistuksen kynnysarvoja oikeaa dataa vasten.
 */
export interface SampleFile {
  format: "modulaatiotreeni-sample";
  version: 1;
  createdAt: string;
  meta: SampleMeta;
  audio: {
    sampleRate: number;
    fftSize: number;
    /** Tallennettujen taajuuskaistojen määrä (alimmat kaistat, loput ovat hiljaisuutta) */
    bins: number;
  };
  /** Tallennushetken asetukset */
  settings: { refA: number; thresholdDb: number; harmonicSuppression: number; minChordMs: number };
  frames: SampleFrame[];
}

export type Instrument = "piano" | "organ" | "other";

export interface SampleMeta {
  instrument: Instrument;
  /** Äänikerrat, soittimen kuvaus tms. vapaana tekstinä */
  registration: string;
  /** Soitettu sointu, tai null = vapaa soitto (esim. kadenssi) */
  expected: Chord | null;
  /** Vapaa kuvaus, esim. äänenkuljetus "G2 H3 D4 F4" */
  notes: string;
}

export interface SampleFrame {
  /** ms tallennuksen alusta */
  t: number;
  /** RMS-taso dBFS (1 desimaali) */
  level: number;
  /** dB-spektri kymmenesosadesibeleinä (kokonaisluvut), `audio.bins` kaistaa */
  db: number[];
  /** Mitä sovellus tunnisti tallennushetkellä (chordId tai null) */
  instant: string | null;
  stable: string | null;
}

/** Tallennuksessa säilytetään kaistat tähän taajuuteen asti (analyysin alipäästö on 2,2 kHz). */
export const SAMPLE_MAX_HZ = 2400;

export const sampleBinCount = (sampleRate: number, fftSize: number): number =>
  Math.min(fftSize / 2, Math.ceil(SAMPLE_MAX_HZ / (sampleRate / fftSize)) + 1);

export function encodeDb(freqDb: ArrayLike<number>, bins: number): number[] {
  const out = new Array<number>(bins);
  for (let i = 0; i < bins; i++) {
    const v = freqDb[i];
    out[i] = Number.isFinite(v) ? Math.max(-1200, Math.round(v * 10)) : -1200;
  }
  return out;
}

/** Kehyksen lineaarinen magnitudispektri (sama muoto kuin MicInput.mags). */
export function frameMags(file: SampleFile, frame: SampleFrame): Float32Array {
  const mags = new Float32Array(file.audio.fftSize / 2);
  for (let i = 0; i < frame.db.length; i++) mags[i] = frame.db[i] <= -1200 ? 0 : Math.pow(10, frame.db[i] / 200);
  return mags;
}

const ASCII_SUFFIX: Record<ChordQuality, string> = { maj: "", min: "m", "7": "7", dim: "dim", maj7: "maj7", m7: "m7" };

/** Tiedostonimiin sopiva nimi, esim. "G7", "Fism", "Bb". */
export function chordAsciiLabel(c: Chord): string {
  return pcToName(c.root, [3, 8, 10].includes(c.root)).replace("#", "is") + ASCII_SUFFIX[c.quality];
}

// --- Uudelleenajo ---

export interface ReplayOptions {
  /** true = tunnistuksen säädöt oletusarvoista, ei tallennushetken asetuksista
   *  (viritys ja herkkyyskynnys otetaan silti tallennuksesta, koska ne riippuvat soittimesta ja mikrofonista) */
  defaults?: boolean;
  chroma?: Partial<ChromaOptions>;
  tracker?: Partial<TrackerOptions>;
  /** Oletuksena tallennushetken kynnys */
  thresholdDb?: number;
}

export interface ReplayFrame {
  t: number;
  level: number;
  above: boolean;
  chroma: number[] | null;
  bass: PitchClass | null;
  instant: ChordMatch | null;
  stable: Chord | null;
}

export interface ReplaySummary {
  /** Kehyksiä, joissa taso ylitti kynnyksen */
  framesAbove: number;
  /** Niistä kehyksiä, joissa hetkellinen tunnistus oli odotettu sointu */
  framesCorrect: number;
  /** Kehyksiä, joissa tunnistettiin jokin muu sointu */
  framesWrong: number;
  /** Aika ensimmäisestä kynnyksen ylittävästä kehyksestä siihen, kun vakaa sointu = odotettu (ms) */
  stableAfterMs: number | null;
  /** Kaikki vakaat soinnut järjestyksessä (null = ei sointua) */
  stableSequence: (Chord | null)[];
}

/** Trackerin tavoitteeksi odotetun soinnun oma sävellaji (kadenssia ei tässä arvioida). */
function replayKey(c: Chord | null): MusicKey {
  const mode = c?.quality === "min" || c?.quality === "m7" ? "minor" : "major";
  return ALL_KEYS.find((k) => k.pc === (c?.root ?? 0) && k.mode === mode)!;
}

/** Ajaa näytteen tunnistusketjun läpi samoin kuin PracticeEngine.tick (ilman metronomin maskausta). */
export function replaySample(file: SampleFile, opts: ReplayOptions = {}): { frames: ReplayFrame[]; summary: ReplaySummary } {
  const expected = file.meta.expected;
  const threshold = opts.thresholdDb ?? file.settings.thresholdDb;
  const saved = opts.defaults
    ? { harmonicSuppression: DEFAULT_CHROMA_OPTIONS.harmonicSuppression, minChordMs: DEFAULT_TRACKER_OPTIONS.minChordMs }
    : file.settings;
  const chromaOpts: Partial<ChromaOptions> = {
    refA: file.settings.refA,
    harmonicSuppression: saved.harmonicSuppression,
    ...opts.chroma,
  };
  const tracker = new HarmonyTracker(replayKey(expected), { minChordMs: saved.minChordMs, ...opts.tracker });

  const frames: ReplayFrame[] = [];
  const summary: ReplaySummary = { framesAbove: 0, framesCorrect: 0, framesWrong: 0, stableAfterMs: null, stableSequence: [] };
  let firstAbove: number | null = null;

  for (const f of file.frames) {
    const above = f.level >= threshold;
    let chroma: number[] | null = null;
    let bass: PitchClass | null = null;
    if (above) {
      const r = computeChroma(frameMags(file, f), file.audio.sampleRate, file.audio.fftSize, chromaOpts);
      if (r.chroma.some((v) => v > 0)) {
        chroma = r.chroma;
        bass = r.bass;
      }
    }
    const res = tracker.process(f.t, chroma, bass);
    frames.push({ t: f.t, level: f.level, above, chroma, bass, instant: res.instant, stable: res.stable });

    if (above) {
      summary.framesAbove++;
      firstAbove ??= f.t;
      if (res.instant && expected) {
        if (sameChord(res.instant, expected)) summary.framesCorrect++;
        else summary.framesWrong++;
      }
    }
    if (res.change) summary.stableSequence.push(res.change.chord);
    if (expected && summary.stableAfterMs === null && sameChord(res.stable, expected)) {
      summary.stableAfterMs = f.t - (firstAbove ?? f.t);
    }
  }
  return { frames, summary };
}

export const sampleChordId = (c: Chord | null): string | null => (c ? chordId(c) : null);
