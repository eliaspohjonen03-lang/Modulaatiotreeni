import { chordLabel, SELECTABLE_KEYS, spellingsOf, type ChordMatch, type MusicKey } from "../music";
import { keyShortName } from "./format";

interface Props {
  listening: boolean;
  instant: ChordMatch | null;
  onChoose: (key: MusicKey | "random") => void;
}

/** Aloitus: lähtösävellaji valitaan ruudukosta tai soittamalla sointu. */
export function StartChooser({ listening, instant, onChoose }: Props) {
  return (
    <div className="start-chooser">
      <h1>Mistä lähdetään?</h1>
      {listening && (
        <>
          <p className="hint">
            Soita sointu soittimella ja pidä se hetki, tai valitse alta.
            {instant && <> Kuulen: <b>{chordLabel(instant)}</b></>}
          </p>
          {(["major", "minor"] as const).map((mode) => (
            <div key={mode} className="key-grid" aria-label={mode === "major" ? "Duurit" : "Mollit"}>
              {SELECTABLE_KEYS.filter((k) => k.mode === mode).map(({ sound }) => (
                <button key={sound} className="chip key-chip" onClick={() => onChoose(spellingsOf(sound)[0])}>
                  {keyShortName(sound)}
                </button>
              ))}
            </div>
          ))}
          <button className="btn" onClick={() => onChoose("random")}>Arvo lähtösävellaji</button>
        </>
      )}
    </div>
  );
}
