const MIN_DB = -90;
const MAX_DB = 0;
const pct = (db: number) => Math.max(0, Math.min(100, ((db - MIN_DB) / (MAX_DB - MIN_DB)) * 100));

export function LevelMeter({ levelDb, thresholdDb, active, large = false }: { levelDb: number; thresholdDb: number; active: boolean; large?: boolean }) {
  return (
    <div className={`meter ${large ? "meter-large" : ""}`} role="meter" aria-label="Mikrofonin taso" aria-valuenow={Math.round(levelDb)} aria-valuemin={MIN_DB} aria-valuemax={MAX_DB}>
      <div className={`meter-fill ${active ? "on" : ""}`} style={{ width: `${pct(levelDb)}%` }} />
      <div className="meter-threshold" style={{ left: `${pct(thresholdDb)}%` }} />
    </div>
  );
}
