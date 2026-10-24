import { useRef, useState, type ReactNode } from "react";
import {
  ALL_KEYS, clampBpm, finnishNoteName, keyDisplayName, MAX_BPM, MAX_REF_A, MIN_BPM, MIN_REF_A, pcToName, signatureText, tapTempo,
  ALL_SOUNDS, SELECTABLE_KEYS, soundsWithAccidentals,
  type DistanceLevel, type SampleFile, type SampleMeta, type TimeSignature,
} from "../music";
import type { EngineSnapshot } from "../audio/engine";
import { DEFAULT_SETTINGS, type Settings } from "../settings";
import { keyShortName } from "./format";
import { LevelMeter } from "./LevelMeter";
import { SampleRecorder } from "./SampleRecorder";

interface Props {
  settings: Settings;
  snap: EngineSnapshot;
  onChange: (patch: Partial<Settings>) => void;
  onClose: () => void;
  onRestart: () => void;
  onStartListening: () => void;
  onCalibrate: () => Promise<{ refA: number | null; freq: number | null; samples: number }>;
  onRecordSample: (meta: SampleMeta, durationMs: number) => Promise<SampleFile>;
}

function Segmented<T extends string>({ value, options, onChange }: { value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div className="segmented" role="radiogroup">
      {options.map(([v, label]) => (
        <button key={v} role="radio" aria-checked={value === v} className={value === v ? "sel" : ""} onClick={() => onChange(v)}>
          {label}
        </button>
      ))}
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="toggle">
      <span>{label}</span>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="switch" aria-hidden />
    </label>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="card">
      <h2>{title}</h2>
      {children}
    </section>
  );
}

function Slider({ label, value, min, max, step, unit, onChange, format }: {
  label: string; value: number; min: number; max: number; step: number; unit?: string; onChange: (v: number) => void; format?: (v: number) => string;
}) {
  return (
    <label className="slider">
      <span className="slider-head">
        <span>{label}</span>
        <b>{format ? format(value) : value}{unit ? ` ${unit}` : ""}</b>
      </span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  );
}

const PRESETS: [string, string[]][] = [
  ["0–2 etumerkkiä", soundsWithAccidentals(0, 2)],
  ["3–4", soundsWithAccidentals(3, 4)],
  ["5–6", soundsWithAccidentals(5, 7)],
  ["Kaikki", [...ALL_SOUNDS]],
];

/** Mukana olevat sävellajit: pikavalinnat etumerkkien mukaan ja yksittäiset sävellajit. */
function KeyPicker({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const set = new Set(value);
  const toggle = (sound: string) => onChange(set.has(sound) ? value.filter((x) => x !== sound) : [...value, sound]);
  const togglePreset = (sounds: string[]) => {
    const all = sounds.every((x) => set.has(x));
    onChange(all ? value.filter((x) => !sounds.includes(x)) : [...new Set([...value, ...sounds])]);
  };
  return (
    <>
      <p className="label">Sävellajit mukana ({value.length}/{ALL_SOUNDS.length})</p>
      <div className="preset-row">
        {PRESETS.map(([label, sounds]) => (
          <button key={label} className={`chip ${sounds.every((x) => set.has(x)) ? "sel" : ""}`} onClick={() => togglePreset(sounds)}>{label}</button>
        ))}
      </div>
      {(["major", "minor"] as const).map((mode) => (
        <div key={mode}>
          <p className="label">{mode === "major" ? "Duurit" : "Mollit"}</p>
          <div className="key-grid">
            {SELECTABLE_KEYS.filter((k) => k.mode === mode).map(({ sound }) => (
              <button key={sound} className={`chip key-chip ${set.has(sound) ? "sel" : ""}`} aria-pressed={set.has(sound)} onClick={() => toggle(sound)}>
                {keyShortName(sound)}
              </button>
            ))}
          </div>
        </div>
      ))}
      {value.length === 0 && <p className="hint">Valitse vähintään yksi sävellaji. Nyt mukana ovat kaikki.</p>}
    </>
  );
}

const DISTANCE_OPTIONS: [DistanceLevel, string][] = [["near", "Lähi 0–1"], ["medium", "Keski 2–3"], ["far", "Kaukainen 4–6"]];

/** Etäisyystasot monivalintana; viimeistä valittua ei voi poistaa. */
function DistancePicker({ value, onChange }: { value: DistanceLevel[]; onChange: (v: DistanceLevel[]) => void }) {
  const all = DISTANCE_OPTIONS.every(([d]) => value.includes(d));
  const toggle = (d: DistanceLevel) => {
    if (!value.includes(d)) onChange(DISTANCE_OPTIONS.map(([x]) => x).filter((x) => x === d || value.includes(x)));
    else if (value.length > 1) onChange(value.filter((x) => x !== d));
  };
  return (
    <div className="segmented">
      {DISTANCE_OPTIONS.map(([d, label]) => (
        <button key={d} aria-pressed={value.includes(d)} className={value.includes(d) ? "sel" : ""} onClick={() => toggle(d)}>
          {label}
        </button>
      ))}
      <button aria-pressed={all} className={all ? "sel" : ""} onClick={() => onChange(DISTANCE_OPTIONS.map(([d]) => d))}>
        Kaikki
      </button>
    </div>
  );
}

const sortedKeys = (mode: "major" | "minor") => ALL_KEYS.filter((k) => k.mode === mode).sort((a, b) => a.accidentals - b.accidentals || Number(a.flats) - Number(b.flats));

export function SettingsView({ settings: s, snap, onChange, onClose, onRestart, onStartListening, onCalibrate, onRecordSample }: Props) {
  const taps = useRef<number[]>([]);
  const [calib, setCalib] = useState<string | null>(null);
  const [calibrating, setCalibrating] = useState(false);

  const tap = () => {
    const now = performance.now();
    taps.current = [...taps.current.filter((t) => now - t < 8000), now];
    const bpm = tapTempo(taps.current);
    if (bpm) onChange({ bpm });
  };

  const calibrate = async () => {
    setCalibrating(true);
    setCalib(`Soita nyt pitkä ${finnishNoteName(pcToName(s.calibrationPc))}-sävel (3 s)…`);
    try {
      const r = await onCalibrate();
      if (r.refA) {
        onChange({ refA: r.refA });
        setCalib(`Viritys asetettu: A = ${r.refA} Hz (mitattu ${r.freq!.toFixed(1)} Hz).`);
      } else if (r.freq) {
        setCalib(`Mitattu ${r.freq.toFixed(1)} Hz ei sovi valittuun säveleen alueella ${MIN_REF_A}–${MAX_REF_A} Hz. Tarkista sävel ja yritä uudelleen.`);
      } else {
        setCalib("Ääntä ei kuulunut riittävästi. Soita kovempaa tai laske herkkyyskynnystä.");
      }
    } catch (e) {
      setCalib((e as Error).message);
    } finally {
      setCalibrating(false);
    }
  };

  return (
    <main className="settings">
      <header className="settings-head">
        <h1>Asetukset</h1>
        <button className="btn primary" onClick={onClose}>Valmis</button>
      </header>

      <Section title="Harjoitus">
        <KeyPicker value={s.sounds} onChange={(sounds) => onChange({ sounds })} />
        <p className="label">Vaikeustaso: modulaation etäisyys</p>
        <DistancePicker value={s.distances} onChange={(distances) => onChange({ distances })} />
        <p className="hint">Askeleet kvinttiympyrällä edellisestä sävellajista. Tasoja voi valita useamman. Jos valituista sävellajeista ei löydy sopivan etäistä, valitaan lähin.</p>
        <label className="field">
          <span className="label">Lähtösävellaji</span>
          <select value={s.startKey} onChange={(e) => onChange({ startKey: e.target.value })}>
            <option value="ask">Valitse tai soita aloitettaessa</option>
            <option value="random">Arvo valituista</option>
            {(["major", "minor"] as const).map((mode) => (
              <optgroup key={mode} label={mode === "major" ? "Duurit" : "Mollit"}>
                {sortedKeys(mode).map((k) => (
                  <option key={k.id} value={k.id}>{keyDisplayName(k)} ({signatureText(k)})</option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
        <button className="btn" onClick={onRestart}>Aloita alusta lähtösävellajista</button>
        <Toggle label="Äänimerkki onnistuessa" checked={s.beep} onChange={(beep) => onChange({ beep })} />
      </Section>

      <Section title="Metronomi">
        <Toggle label="Metronomi päällä" checked={s.metronomeOn} onChange={(metronomeOn) => onChange({ metronomeOn })} />
        <div className="bpm-row">
          <button className="btn big" onClick={() => onChange({ bpm: clampBpm(s.bpm - 1) })} aria-label="Hitaammin">−</button>
          <div className="bpm"><b>{s.bpm}</b><span>BPM</span></div>
          <button className="btn big" onClick={() => onChange({ bpm: clampBpm(s.bpm + 1) })} aria-label="Nopeammin">+</button>
          <button className="btn big" onClick={tap}>Tap</button>
        </div>
        <input type="range" min={MIN_BPM} max={MAX_BPM} value={s.bpm} onChange={(e) => onChange({ bpm: Number(e.target.value) })} aria-label="Tempo" />
        <p className="label">Tahtilaji</p>
        <Segmented<TimeSignature> value={s.signature} onChange={(signature) => onChange({ signature })} options={[["2/4", "2/4"], ["3/4", "3/4"], ["4/4", "4/4"], ["6/8", "6/8"], ["custom", "Muu"]]} />
        {s.signature === "custom" && (
          <div className="bpm-row">
            <button className="btn" onClick={() => onChange({ customBeats: Math.max(1, s.customBeats - 1) })}>−</button>
            <div className="bpm"><b>{s.customBeats}</b><span>iskua tahdissa</span></div>
            <button className="btn" onClick={() => onChange({ customBeats: Math.min(16, s.customBeats + 1) })}>+</button>
          </div>
        )}
        {s.signature === "6/8" && <p className="hint">6/8: tempo on kahdeksasosien tahti, 1. isku korostettu ja 4. kevyesti.</p>}
        <Slider label="Voimakkuus" value={Math.round(s.metronomeVolume * 100)} min={5} max={100} step={5} unit="%" onChange={(v) => onChange({ metronomeVolume: v / 100 })} />
        <Slider label="Klikin maskaus analyysistä" value={s.clickMaskMs} min={0} max={250} step={10} unit="ms" onChange={(clickMaskMs) => onChange({ clickMaskMs })} />
      </Section>

      <Section title="Mikrofoni ja viritys">
        {!snap.running && !s.testMode && <button className="btn" onClick={onStartListening}>Käynnistä mikrofoni tasomittaria varten</button>}
        {snap.running && s.testMode && <p className="hint">Testitila on päällä: mikrofoni ei ole käytössä.</p>}
        <LevelMeter large levelDb={snap.levelDb} thresholdDb={s.thresholdDb} active={snap.aboveThreshold} />
        <Slider label="Herkkyys: kynnystaso" value={s.thresholdDb} min={-80} max={-15} step={1} unit="dB" onChange={(thresholdDb) => onChange({ thresholdDb })} />
        <p className="hint">Pystyviiva = kynnys. Palkin pitää ylittää se soitettaessa ja jäädä alle hiljaisuudessa.</p>
        <Slider label="Viritys (A4)" value={s.refA} min={MIN_REF_A} max={MAX_REF_A} step={0.5} unit="Hz" onChange={(refA) => onChange({ refA })} />
        <div className="calib-row">
          <label className="field inline">
            <span className="label">Kalibrointisävel</span>
            <select value={s.calibrationPc} onChange={(e) => onChange({ calibrationPc: Number(e.target.value) })}>
              {Array.from({ length: 12 }, (_, pc) => (
                <option key={pc} value={pc}>{finnishNoteName(pcToName(pc, [3, 8, 10].includes(pc)))}</option>
              ))}
            </select>
          </label>
          <button className="btn primary" disabled={calibrating || s.testMode} onClick={calibrate}>
            {calibrating ? "Kuunnellaan…" : "Kalibroi automaattisesti"}
          </button>
        </div>
        {calib && <p className="hint">{calib}</p>}
        <div className="preset-row">
          {[415, 435, 440, 442, 443].map((hz) => (
            <button key={hz} className={`chip ${s.refA === hz ? "sel" : ""}`} onClick={() => onChange({ refA: hz })}>{hz}</button>
          ))}
        </div>
      </Section>

      <Section title="Tunnistus">
        <Slider label="Soinnun minimikesto" value={s.minChordMs} min={150} max={1500} step={50} unit="ms" onChange={(minChordMs) => onChange({ minChordMs })} />
        <p className="hint">Pidempi kesto auttaa kaikuisassa tilassa, lyhyempi nopeassa soitossa.</p>
        <Slider label="Yläsävelten vaimennus" value={Math.round(s.harmonicSuppression * 100)} min={0} max={100} step={5} unit="%" onChange={(v) => onChange({ harmonicSuppression: v / 100 })} />
        <p className="hint">Pianolla 0 %. Nosta uruilla vain, jos mikstuurat tai kvinttiäänikerrat sekoittavat tunnistusta: liian suuri arvo poistaa myös oikeasti soitettuja kvinttejä.</p>
        <Toggle label="Näytä tunnistustiedot harjoitusnäkymässä" checked={s.showDiagnostics} onChange={(showDiagnostics) => onChange({ showDiagnostics })} />
      </Section>

      <Section title="Testinäytteet">
        <SampleRecorder settings={s} onChange={onChange} onRecord={onRecordSample} />
      </Section>

      <Section title="Kehitys">
        <Toggle label="Testitila (näyttöpiano, ei mikrofonia)" checked={s.testMode} onChange={(testMode) => onChange({ testMode })} />
        <button className="btn" onClick={() => onChange({ ...DEFAULT_SETTINGS, sampleInstrument: s.sampleInstrument, sampleRegistration: s.sampleRegistration })}>Palauta oletusasetukset</button>
      </Section>
    </main>
  );
}
