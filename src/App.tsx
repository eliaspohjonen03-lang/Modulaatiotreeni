import { useCallback, useEffect, useRef, useState } from "react";
import { PracticeEngine, type EngineSnapshot, type TestInput } from "./audio/engine";
import { ScreenWakeLock } from "./audio/wakeLock";
import { PracticeSession, type MusicKey } from "./music";
import { loadSettings, saveSettings, type Settings } from "./settings";
import { randomPraise } from "./ui/format";
import { PracticeView } from "./ui/PracticeView";
import { SettingsView } from "./ui/SettingsView";
import { TestPanel } from "./ui/TestPanel";

const PRAISE_MS = 1500;

const sessionSettings = (s: Settings) => ({ sounds: s.sounds, distances: s.distances, startKey: s.startKey });

export function App() {
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const [view, setView] = useState<"practice" | "settings">("practice");
  const [praise, setPraise] = useState<string | null>(null);

  const sessionRef = useRef<PracticeSession | null>(null);
  sessionRef.current ??= new PracticeSession(sessionSettings(settings));
  const session = sessionRef.current;
  const [target, setTarget] = useState<MusicKey>(session.target);
  const [from, setFrom] = useState<MusicKey | null>(null);

  const engineRef = useRef<PracticeEngine | null>(null);
  engineRef.current ??= new PracticeEngine(settings, session.target);
  const engine = engineRef.current;
  const [snap, setSnap] = useState<EngineSnapshot>(engine.snapshot);

  const wakeLock = useRef<ScreenWakeLock | null>(null);
  const praiseActive = useRef(false);
  const lastPraise = useRef<string | null>(null);

  useEffect(() => engine.subscribe(setSnap), [engine]);
  useEffect(() => () => engine.stop(), [engine]);

  useEffect(() => {
    saveSettings(settings);
    session.settings = sessionSettings(settings);
    void engine.applySettings(settings);
  }, [settings, engine, session]);

  useEffect(() => {
    engine.onCadence = () => {
      if (praiseActive.current) return;
      praiseActive.current = true;
      engine.success();
      engine.freeze(PRAISE_MS + 250);
      const text = randomPraise(lastPraise.current);
      lastPraise.current = text;
      setPraise(text);
      window.setTimeout(() => {
        const next = session.advance();
        engine.setTarget(next);
        setFrom(session.history.at(-1) ?? null);
        setTarget(next);
        setPraise(null);
        praiseActive.current = false;
      }, PRAISE_MS);
    };
  }, [engine, session]);

  const update = useCallback((patch: Partial<Settings>) => setSettings((s) => ({ ...s, ...patch })), []);

  const start = useCallback(async () => {
    await engine.start();
    wakeLock.current ??= new ScreenWakeLock();
    await wakeLock.current.enable();
  }, [engine]);

  const stop = useCallback(() => {
    engine.stop();
    void wakeLock.current?.disable();
  }, [engine]);

  const restart = useCallback(() => {
    session.restart(sessionSettings(settings));
    engine.setTarget(session.target);
    setFrom(null);
    setTarget(session.target);
    setView("practice");
  }, [engine, session, settings]);

  const onTestInput = useCallback((i: TestInput | null) => {
    engine.testInput = i;
  }, [engine]);

  if (view === "settings") {
    return (
      <SettingsView
        settings={settings}
        snap={snap}
        onChange={update}
        onClose={() => setView("practice")}
        onRestart={restart}
        onStartListening={() => void start()}
        onCalibrate={() => engine.calibrate()}
        onRecordSample={(meta, ms) => engine.record(meta, ms)}
      />
    );
  }

  return (
    <PracticeView
      target={target}
      from={from}
      praise={praise}
      snap={snap}
      settings={settings}
      onStart={() => void start()}
      onStop={stop}
      onOpenSettings={() => setView("settings")}
      onToggleMetronome={() => update({ metronomeOn: !settings.metronomeOn })}
      testPanel={<TestPanel target={target} onInput={onTestInput} />}
    />
  );
}
