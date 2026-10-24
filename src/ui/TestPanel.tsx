import { useEffect, useRef, useState } from "react";
import { chordLabel, chordPitchClasses, diatonicChords, mod12, type Chord, type MusicKey } from "../music";
import type { TestInput } from "../audio/engine";

const LOW = 48; // C3
const HIGH = 71; // H4
const BLACK = new Set([1, 3, 6, 8, 10]);

function voicing(c: Chord): number[] {
  const root = LOW + c.root;
  const out = [root];
  for (const pc of chordPitchClasses(c).slice(1)) {
    let m = root + mod12(pc - c.root);
    if (m > HIGH) m -= 12;
    out.push(m);
  }
  return out;
}

/** Testitila: näyttöpiano ja sointupikanapit. Pidetyt sävelet syötetään tunnistukseen kuin mikrofonista. */
export function TestPanel({ target, onInput }: { target: MusicKey; onInput: (i: TestInput | null) => void }) {
  const [held, setHeld] = useState<Set<number>>(new Set());
  const timers = useRef<number[]>([]);

  useEffect(() => {
    const notes = [...held].sort((a, b) => a - b);
    onInput(notes.length ? { pcs: notes.map(mod12), bass: mod12(notes[0]) } : null);
  }, [held, onInput]);

  useEffect(
    () => () => {
      timers.current.forEach((t) => window.clearTimeout(t));
      onInput(null);
    },
    [onInput],
  );

  const cancelAuto = () => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  };

  const toggle = (m: number) => {
    cancelAuto();
    setHeld((h) => {
      const n = new Set(h);
      if (n.has(m)) n.delete(m);
      else n.add(m);
      return n;
    });
  };

  const playChord = (c: Chord | null) => setHeld(new Set(c ? voicing(c) : []));

  const chords = diatonicChords(target);
  const autoCadence = () => {
    cancelAuto();
    const find = (r: string) => chords.find((d) => d.roman === r)!.chord;
    const seq = target.mode === "major" ? [find("I"), find("IV"), find("V7"), find("I")] : [find("i"), find("iv"), find("V7"), find("i")];
    seq.forEach((c, i) => timers.current.push(window.setTimeout(() => playChord(c), i * 900)));
    timers.current.push(window.setTimeout(() => playChord(null), seq.length * 900 + 1800));
  };

  const whites: number[] = [];
  for (let m = LOW; m <= HIGH; m++) if (!BLACK.has(mod12(m))) whites.push(m);
  const whiteW = 100 / whites.length;

  return (
    <section className="test-panel" aria-label="Testitila">
      <div className="test-chords">
        {chords.map((d) => (
          <button key={d.roman} className="chip" onClick={() => { cancelAuto(); playChord(d.chord); }}>
            <span className="chip-roman">{d.roman}</span>
            <span>{chordLabel(d.chord, target.flats)}</span>
          </button>
        ))}
        <button className="chip chip-accent" onClick={autoCadence}>Soita kadenssi</button>
        <button className="chip" onClick={() => { cancelAuto(); playChord(null); }}>Hiljaa</button>
      </div>
      <div className="piano">
        {whites.map((m, i) => (
          <button key={m} aria-label={`sävel ${m}`} className={`white ${held.has(m) ? "down" : ""}`} style={{ left: `${i * whiteW}%`, width: `${whiteW}%` }} onClick={() => toggle(m)} />
        ))}
        {Array.from({ length: HIGH - LOW + 1 }, (_, i) => LOW + i)
          .filter((m) => BLACK.has(mod12(m)))
          .map((m) => {
            const leftWhite = whites.indexOf(m - 1);
            return (
              <button key={m} aria-label={`sävel ${m}`} className={`black ${held.has(m) ? "down" : ""}`} style={{ left: `${(leftWhite + 1) * whiteW - whiteW * 0.3}%`, width: `${whiteW * 0.6}%` }} onClick={() => toggle(m)} />
            );
          })}
      </div>
    </section>
  );
}
