import { useEffect, useState } from "react";
import {
  chordLabel, finnishNoteName, pcToName, replaySample,
  type ChordQuality, type Instrument, type SampleFile, type SampleMeta,
} from "../music";
import { saveSample } from "../audio/sampleSave";
import type { Settings } from "../settings";

interface Props {
  settings: Settings;
  onChange: (patch: Partial<Settings>) => void;
  onRecord: (meta: SampleMeta, durationMs: number) => Promise<SampleFile>;
}

const INSTRUMENTS: [Instrument, string][] = [["piano", "Piano"], ["organ", "Urut"], ["other", "Muu"]];
const QUALITIES: [ChordQuality, string][] = [["maj", "Duuri"], ["min", "Molli"], ["7", "7"], ["maj7", "maj7"], ["m7", "m7"], ["dim", "°"]];
const DURATIONS = [3, 5, 10];

interface Saved {
  name: string;
  where: "project" | "download";
  text: string;
  good: boolean | null;
}

/** Testinäytteen tallennus: oikean soittimen spektrit talteen tunnistuksen kehittämistä varten. */
export function SampleRecorder({ settings: s, onChange, onRecord }: Props) {
  const [root, setRoot] = useState<number | "free">(7);
  const [quality, setQuality] = useState<ChordQuality>("7");
  const [voicing, setVoicing] = useState("");
  const [seconds, setSeconds] = useState(5);
  const [left, setLeft] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<Saved[]>([]);

  useEffect(() => {
    if (left === null || left <= 0) return;
    const id = window.setTimeout(() => setLeft((l) => (l === null ? null : l - 1)), 1000);
    return () => window.clearTimeout(id);
  }, [left]);

  const record = async () => {
    setError(null);
    const expected = root === "free" ? null : { root, quality };
    const meta: SampleMeta = { instrument: s.sampleInstrument, registration: s.sampleRegistration.trim(), expected, notes: voicing.trim() };
    setLeft(seconds);
    try {
      const file = await onRecord(meta, seconds * 1000);
      const res = await saveSample(file);
      setSaved((list) => [{ ...res, ...describe(file) }, ...list]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLeft(null);
    }
  };

  const busy = left !== null;
  return (
    <>
      <p className="hint">
        Tallenna oikean soittimen ääntä, niin tunnistusta voidaan kehittää sen perusteella. Valitse, mitä soitat, paina
        <b> Tallenna</b> ja soita heti. Uruilla pidä sointu koko tallennuksen ajan. Pianolla lyö sointu ja anna sen soida.
      </p>
      <p className="label">Soitin</p>
      <div className="segmented" role="radiogroup">
        {INSTRUMENTS.map(([v, label]) => (
          <button key={v} role="radio" aria-checked={s.sampleInstrument === v} className={s.sampleInstrument === v ? "sel" : ""} onClick={() => onChange({ sampleInstrument: v })}>
            {label}
          </button>
        ))}
      </div>
      <label className="field">
        <span className="label">Äänikerrat tai soittimen kuvaus</span>
        <input type="text" value={s.sampleRegistration} placeholder="esim. Principal 8' + Oktaavi 4' / pianino, oikea pedaali" onChange={(e) => onChange({ sampleRegistration: e.target.value })} />
      </label>
      <label className="field">
        <span className="label">Mitä soitat</span>
        <select value={root} onChange={(e) => setRoot(e.target.value === "free" ? "free" : Number(e.target.value))}>
          <option value="free">Vapaa soitto (esim. kadenssi tai improvisaatio)</option>
          {Array.from({ length: 12 }, (_, pc) => (
            <option key={pc} value={pc}>{finnishNoteName(pcToName(pc, [3, 8, 10].includes(pc)))}-pohjainen sointu</option>
          ))}
        </select>
      </label>
      {root !== "free" && (
        <div className="segmented" role="radiogroup">
          {QUALITIES.map(([v, label]) => (
            <button key={v} role="radio" aria-checked={quality === v} className={quality === v ? "sel" : ""} onClick={() => setQuality(v)}>
              {label}
            </button>
          ))}
        </div>
      )}
      <label className="field">
        <span className="label">{root === "free" ? "Mitä soitit (valinnainen)" : "Äänenkuljetus (valinnainen)"}</span>
        <input type="text" value={voicing} placeholder={root === "free" ? "esim. C: I–IV–V7–I" : "esim. G2 H3 D4 F4"} onChange={(e) => setVoicing(e.target.value)} />
      </label>
      <p className="label">Kesto</p>
      <div className="segmented" role="radiogroup">
        {DURATIONS.map((d) => (
          <button key={d} role="radio" aria-checked={seconds === d} className={seconds === d ? "sel" : ""} onClick={() => setSeconds(d)}>
            {d} s
          </button>
        ))}
      </div>
      <button className="btn primary" disabled={busy || s.testMode} onClick={() => void record()}>
        {busy ? `Tallennetaan… ${Math.max(0, left)} s` : `Tallenna ${root === "free" ? "näyte" : chordLabel({ root, quality })}`}
      </button>
      {busy && <p className="recording">● Soita nyt!</p>}
      {s.testMode && <p className="hint">Testitila on päällä: näytteen tallennus vaatii mikrofonin.</p>}
      {error && <p className="sample-result bad">{error}</p>}
      {saved.length > 0 && (
        <>
          <p className={`sample-result ${saved[0].good === null ? "" : saved[0].good ? "good" : "bad"}`}>{saved[0].text}</p>
          <p className="hint">
            {saved[0].where === "project" ? "Tallennettu projektikansioon:" : "Ladattu tiedostona (siirrä se projektin samples/-kansioon):"}
          </p>
          <ul className="sample-list">
            {saved.map((x) => <li key={x.name}>{x.name}</li>)}
          </ul>
        </>
      )}
    </>
  );
}

/** Lyhyt palaute heti tallennuksen jälkeen: tunnistiko sovellus soitetun soinnun. */
function describe(file: SampleFile): { text: string; good: boolean | null } {
  const { summary } = replaySample(file);
  if (summary.framesAbove === 0) return { text: "Ääni jäi koko ajan kynnyksen alle. Soita kovempaa tai laske herkkyyskynnystä.", good: false };
  const expected = file.meta.expected;
  if (!expected) return { text: `Tallennettu ${(file.frames.length * 0.05).toFixed(1)} s.`, good: null };
  const pct = Math.round((100 * summary.framesCorrect) / summary.framesAbove);
  const name = chordLabel(expected);
  if (summary.stableAfterMs === null) return { text: `${name} ei tunnistunut vakaaksi (hetkellisesti oikein ${pct} % ajasta).`, good: false };
  return { text: `${name} tunnistui ${(summary.stableAfterMs / 1000).toFixed(1)} s kohdalla (hetkellisesti oikein ${pct} % ajasta).`, good: true };
}
