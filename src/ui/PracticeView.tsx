import type { ReactNode } from "react";
import { beatsPerBar, keyDisplayName, type MusicKey } from "../music";
import type { EngineSnapshot } from "../audio/engine";
import type { Settings } from "../settings";
import { chordText, keyScoreName } from "./format";
import { LevelMeter } from "./LevelMeter";

interface Props {
  target: MusicKey;
  praise: string | null;
  snap: EngineSnapshot;
  settings: Settings;
  onStart: () => void;
  onStop: () => void;
  onOpenSettings: () => void;
  onToggleMetronome: () => void;
  testPanel: ReactNode;
}

export function PracticeView({ target, praise, snap, settings, onStart, onStop, onOpenSettings, onToggleMetronome, testPanel }: Props) {
  const beats = beatsPerBar(settings.signature, settings.customBeats);
  const sig = settings.signature === "custom" ? `${settings.customBeats}/4` : settings.signature;
  const showDiag = settings.showDiagnostics || settings.testMode;

  return (
    <main className={`practice ${settings.testMode ? "with-test" : ""}`}>
      <header className="topbar">
        <div className="status">
          {settings.testMode ? (
            <span className="badge">Testitila</span>
          ) : (
            <LevelMeter levelDb={snap.levelDb} thresholdDb={settings.thresholdDb} active={snap.aboveThreshold} />
          )}
          <button className={`metro-status ${settings.metronomeOn ? "on" : ""}`} onClick={onToggleMetronome} aria-label="Metronomi päälle tai pois">
            <span aria-hidden>♩</span> {settings.metronomeOn ? `${settings.bpm} · ${sig}` : "pois"}
            {settings.metronomeOn && snap.running && (
              <span className="beats" aria-hidden>
                {Array.from({ length: beats }, (_, i) => (
                  <i key={i} className={snap.beat === i ? (i === 0 ? "now first" : "now") : ""} />
                ))}
              </span>
            )}
          </button>
        </div>
        <div className="top-actions">
          {snap.running && (
            <button className="icon-btn" onClick={onStop} aria-label="Pysäytä">
              <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden><rect x="6" y="5" width="4" height="14" rx="1" fill="currentColor" /><rect x="14" y="5" width="4" height="14" rx="1" fill="currentColor" /></svg>
            </button>
          )}
          <button className="icon-btn" onClick={onOpenSettings} aria-label="Asetukset">
            <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden>
              <path fill="currentColor" d="M19.4 13a7.5 7.5 0 0 0 0-2l2-1.6-2-3.4-2.4 1a7.6 7.6 0 0 0-1.7-1L15 3.5h-4l-.4 2.5a7.6 7.6 0 0 0-1.7 1l-2.4-1-2 3.4L6.6 11a7.5 7.5 0 0 0 0 2l-2 1.6 2 3.4 2.4-1a7.6 7.6 0 0 0 1.7 1l.4 2.5h4l.4-2.5a7.6 7.6 0 0 0 1.7-1l2.4 1 2-3.4-2.1-1.6ZM13 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7Z" transform="translate(-1 0)" />
            </svg>
          </button>
        </div>
      </header>

      <section className="stage" aria-live="polite">
        {praise ? (
          <div className="praise" key="praise">{praise}</div>
        ) : (
          <div className="target" key={target.id}>{keyDisplayName(target)}</div>
        )}
        {!snap.running && (
          <button className="start-btn" onClick={onStart}>
            {settings.testMode ? "Aloita (testitila)" : "Aloita kuuntelu"}
          </button>
        )}
        {snap.error && <p className="error">{snap.error}</p>}
      </section>

      {showDiag && snap.running && (
        <p className="diag">
          Kuulen: <b>{chordText(snap.instant, target)}</b> · vakaa: <b>{chordText(snap.stable, target)}</b>
          {snap.topKeys.length > 0 && <> · arvio: {snap.topKeys.map((k) => `${keyScoreName(k)} ${k.r.toFixed(2)}`).join(", ")}</>}
          {snap.support && <> · tavoite {snap.support.ok ? "✓" : "–"}</>}
        </p>
      )}

      {settings.testMode && testPanel}
    </main>
  );
}
