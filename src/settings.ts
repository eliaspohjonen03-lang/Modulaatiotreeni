import { DEFAULT_CHROMA_OPTIONS, DEFAULT_TRACKER_OPTIONS, type Difficulty, type Instrument, type ModeFilter, type TimeSignature } from "./music";

export interface Settings {
  level: Difficulty;
  modes: ModeFilter;
  /** "random" tai sävellajin id, esim. "major:C" */
  startKey: string;
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
  level: "easy",
  modes: "both",
  startKey: "major:C",
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
const SETTINGS_VERSION = 2;

type Stored = Partial<Settings> & { v?: number };

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const { v = 1, ...stored } = JSON.parse(raw) as Stored;
    // v2: yläsävelten vaimennuksen oletus 60 % → 0 % (oikeat pianonäytteet).
    if (v < 2) delete stored.harmonicSuppression;
    return { ...DEFAULT_SETTINGS, ...stored };
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
