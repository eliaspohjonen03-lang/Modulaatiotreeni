import { useMemo, useState } from "react";
import { distanceText, keyDisplayName, modulationRoutes, spelledChordLabel, startRoute, type ModulationRoute, type MusicKey, type RouteStep } from "../music";

interface Props {
  from: MusicKey | null;
  to: MusicKey;
  onClose: () => void;
}

const inKey = (k: MusicKey) => `${keyDisplayName(k)}ssa`;

function degreeText(s: RouteStep): string {
  if (s.from && s.to) return `${s.from} = ${s.to}`;
  return s.from ?? s.to ?? "";
}

function Route({ route, from, to }: { route: ModulationRoute; from: MusicKey | null; to: MusicKey }) {
  return (
    <section className="route">
      <h3>{route.title}</h3>
      <ol className="route-steps">
        {route.steps.map((s, i) => (
          <li key={i} className={s.to && !s.from ? "in-target" : s.from && s.to ? "pivot" : ""}>
            <b>
              {spelledChordLabel(s.chord)}
              {s.respelled && <> = {spelledChordLabel(s.respelled)}</>}
            </b>
            <span>{degreeText(s)}</span>
          </li>
        ))}
      </ol>
      <p className="route-explain">{route.explanation}</p>
      {from && route.steps.some((s) => s.from && s.to) && (
        <p className="route-legend">Kehystetty sointu on silta: aste {inKey(from)} = aste {inKey(to)}.</p>
      )}
    </section>
  );
}

/** Modulaatiovinkki: helpoin reitti ensin, "+" näyttää seuraavan tavan. */
export function HintPanel({ from, to, onClose }: Props) {
  const routes = useMemo(() => (from ? modulationRoutes(from, to) : [startRoute(to)]), [from, to]);
  const [shown, setShown] = useState(1);

  return (
    <aside className="hint-panel" aria-label="Modulaatiovinkki">
      <header className="hint-head">
        <div>
          <h2>{from ? `${keyDisplayName(from)} → ${keyDisplayName(to)}` : keyDisplayName(to)}</h2>
          <p>{from ? distanceText(from, to) : "Lähtösävellaji"}</p>
        </div>
        <button className="btn" onClick={onClose}>Sulje</button>
      </header>
      {routes.slice(0, shown).map((r) => (
        <Route key={r.technique} route={r} from={from} to={to} />
      ))}
      {shown < routes.length && (
        <button className="btn more-btn" onClick={() => setShown((n) => n + 1)}>
          <span aria-hidden>＋</span> Toinen tapa ({routes.length - shown} jäljellä)
        </button>
      )}
    </aside>
  );
}
