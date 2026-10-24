import { clampBpm, MAX_BPM, MIN_BPM } from "../music";

/** Metronomin tempo soittonäkymässä: − liukusäädin + */
export function TempoBar({ bpm, onChange }: { bpm: number; onChange: (bpm: number) => void }) {
  return (
    <div className="tempo-bar">
      <button className="btn tempo-step" onClick={() => onChange(clampBpm(bpm - 1))} aria-label="Hitaammin">−</button>
      <input type="range" min={MIN_BPM} max={MAX_BPM} value={bpm} onChange={(e) => onChange(Number(e.target.value))} aria-label="Tempo" />
      <button className="btn tempo-step" onClick={() => onChange(clampBpm(bpm + 1))} aria-label="Nopeammin">+</button>
      <span className="tempo-value"><b>{bpm}</b> BPM</span>
    </div>
  );
}
