import {
  ALL_SOUNDS, DEFAULT_CHROMA_OPTIONS, DEFAULT_TRACKER_OPTIONS, soundsWithAccidentals, type DistanceLevel, type Instrument, type TimeSignature,
} from "./music";

export interface Settings {
  /** Mukana olevat sävellajit (soundId, esim. "major:0" = C-duuri) */
  sounds: string[];
  /** Modulaation vaikeus: etäisyys kvinttiympyrällä */
  distance: DistanceLevel;
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
  sounds: soundsWithAccidentals(0, 2),
  distance: "all",
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
const SETTINGS_VERSION = 3;

/** v1–v2: vaikeustaso etumerkkien mukaan + duurit/mollit */
type Stored = Partial<Settings> & { v?: number; level?: "easy" | "medium" | "hard" | "all"; modes?: "major" | "minor" | "both" };

const OLD_LEVELS = { easy: [0, 2], medium: [3, 4], hard: [5, 7], all: [0, 7] } as const;

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const { v = 1, ...stored } = JSON.parse(raw) as Stored;
    // v2: yläsävelten vaimennuksen oletus 60 % → 0 % (oikeat pianonäytteet).
    if (v < 2) delete stored.harmonicSuppression;
    // v3: etumerkkitaso → valitut sävellajit, uutena modulaation etäisyys.
    const { level, modes, ...rest } = stored;
    if (v < 3 && level) {
      const [lo, hi] = OLD_LEVELS[level] ?? OLD_LEVELS.easy;
      rest.sounds = soundsWithAccidentals(lo, hi).filter((id) => !modes || modes === "both" || id.startsWith(modes));
    }
    const merged = { ...DEFAULT_SETTINGS, ...rest };
    merged.sounds = merged.sounds.filter((id) => ALL_SOUNDS.includes(id));
    return merged;
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
