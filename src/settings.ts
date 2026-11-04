import {
  ALL_SOUNDS, clampBpm, DEFAULT_CHROMA_OPTIONS, keyById, MAX_REF_A, MIN_REF_A, DEFAULT_TRACKER_OPTIONS, ALL_DISTANCES, soundsWithAccidentals, type DistanceLevel, type Instrument, type SuccessMode, type TimeSignature,
} from "./music";

export interface Settings {
  /** Mukana olevat sävellajit (soundId, esim. "major:0" = C-duuri) */
  sounds: string[];
  /** Modulaation vaikeus: sallitut etäisyydet kvinttiympyrällä (yhdisteltävissä) */
  distances: DistanceLevel[];
  /** "random" tai sävellajin id, esim. "major:C" */
  startKey: string;
  /** Uusi sävellaji annetaan kadenssista vai pelkästä tonikasoinnusta */
  successOn: SuccessMode;
  metronomeOn: boolean;
  bpm: number;
  signature: TimeSignature;
  customBeats: number;
  metronomeVolume: number;
  /** Analyysistä pois jätettävä aika jokaisen klikin jälkeen, ms */
  clickMaskMs: number;
  /** Herkkyys: tätä hiljaisempi ääni = hiljaisuus (dBFS) */
  thresholdDb: number;
  refA: number;
  /** Sävel, jota automaattisessa vireen kalibroinnissa soitetaan (sävelluokka, 9 = A) */
  calibrationPc: number;
  minChordMs: number;
  harmonicSuppression: number;
  beep: boolean;
  testMode: boolean;
  showDiagnostics: boolean;
  /** Testinäytteiden tallennuksen muistetut valinnat */
  sampleInstrument: Instrument;
  sampleRegistration: string;
}

export const DEFAULT_SETTINGS: Settings = {
  sounds: soundsWithAccidentals(0, 2),
  distances: [...ALL_DISTANCES],
  startKey: "ask",
  successOn: "cadence",
  metronomeOn: false,
  bpm: 80,
  signature: "4/4",
  customBeats: 5,
  metronomeVolume: 0.5,
  clickMaskMs: 80,
  thresholdDb: -50,
  refA: 440,
  calibrationPc: 9,
  minChordMs: DEFAULT_TRACKER_OPTIONS.minChordMs,
  harmonicSuppression: DEFAULT_CHROMA_OPTIONS.harmonicSuppression,
  beep: true,
  testMode: false,
  showDiagnostics: false,
  sampleInstrument: "piano",
  sampleRegistration: "",
};

const STORAGE_KEY = "modulaatiotreeni.settings.v1";
/** Kasvatetaan, kun tunnistuksen oletusarvoja muutetaan: vanhat tallennetut arvot korvataan uusilla. */
const SETTINGS_VERSION = 5;

/** v1–v2: vaikeustaso etumerkkien mukaan + duurit/mollit; v3: yksi etäisyystaso */
type Stored = Partial<Settings> & {
  v?: number;
  level?: "easy" | "medium" | "hard" | "all";
  modes?: "major" | "minor" | "both";
  distance?: DistanceLevel | "all";
};

const SIGNATURES: readonly TimeSignature[] = ["2/4", "3/4", "4/4", "6/8", "custom"];
const INSTRUMENTS: readonly Instrument[] = ["piano", "organ", "other"];
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * Korjaa tallennetut arvot: väärän tyyppiset (esim. käsin muokattu tai vanhan
 * version jäänne) korvataan oletuksella ja luvut rajataan järkeville alueille,
 * jottei esim. tempo 0 tai NaN jumita metronomia.
 */
function sanitize(input: Record<string, unknown>): Settings {
  const out: Record<string, unknown> = { ...DEFAULT_SETTINGS };
  for (const key of Object.keys(DEFAULT_SETTINGS) as (keyof Settings)[]) {
    const def = DEFAULT_SETTINGS[key];
    const v = input[key];
    if (Array.isArray(def) ? Array.isArray(v) : typeof v === typeof def && (typeof v !== "number" || Number.isFinite(v))) out[key] = v;
  }
  const s = out as unknown as Settings;
  s.distances = s.distances.filter((d) => ALL_DISTANCES.includes(d));
  if (s.distances.length === 0) s.distances = [...ALL_DISTANCES];
  s.sounds = s.sounds.filter((id) => ALL_SOUNDS.includes(id));
  if (s.successOn !== "cadence" && s.successOn !== "tonic") s.successOn = "cadence";
  if (s.startKey !== "ask" && s.startKey !== "random" && !keyById(s.startKey)) s.startKey = DEFAULT_SETTINGS.startKey;
  if (!SIGNATURES.includes(s.signature)) s.signature = DEFAULT_SETTINGS.signature;
  if (!INSTRUMENTS.includes(s.sampleInstrument)) s.sampleInstrument = DEFAULT_SETTINGS.sampleInstrument;
  s.bpm = clampBpm(s.bpm);
  s.customBeats = Math.round(clamp(s.customBeats, 1, 16));
  s.metronomeVolume = clamp(s.metronomeVolume, 0, 1);
  s.clickMaskMs = clamp(s.clickMaskMs, 0, 250);
  s.thresholdDb = clamp(s.thresholdDb, -80, -15);
  s.refA = clamp(s.refA, MIN_REF_A, MAX_REF_A);
  s.calibrationPc = Math.round(clamp(s.calibrationPc, 0, 11));
  s.minChordMs = clamp(s.minChordMs, 150, 1500);
  s.harmonicSuppression = clamp(s.harmonicSuppression, 0, 1);
  return s;
}

const OLD_LEVELS = { easy: [0, 2], medium: [3, 4], hard: [5, 7], all: [0, 7] } as const;

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return { ...DEFAULT_SETTINGS };
    const { v = 1, ...stored } = parsed as Stored;
    // v2: yläsävelten vaimennuksen oletus 60 % → 0 % (oikeat pianonäytteet).
    if (v < 2) delete stored.harmonicSuppression;
    // v3: etumerkkitaso → valitut sävellajit, uutena modulaation etäisyys.
    const { level, modes, distance, ...rest } = stored;
    if (v < 3 && level) {
      const [lo, hi] = OLD_LEVELS[level] ?? OLD_LEVELS.easy;
      rest.sounds = soundsWithAccidentals(lo, hi).filter((id) => !modes || modes === "both" || id.startsWith(modes));
    }
    // v5: uusi oletus "valitse tai soita aloitettaessa"; vanha oletus C-duuri vaihtuu siihen.
    if (v < 5 && rest.startKey === "major:C") rest.startKey = "ask";
    // v4: yksi etäisyystaso → yhdisteltävät tasot.
    if (v < 4 && distance && distance !== "all") rest.distances = [distance];
    return sanitize(rest);
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(s: Settings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...s, v: SETTINGS_VERSION }));
  } catch {
    // Tallennus ei onnistu (esim. yksityinen selausikkuna) – asetukset säilyvät istunnon ajan.
  }
}
