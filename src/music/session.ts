import { keyById, pickNextKey, type DistanceLevel, type MusicKey } from "./keys";

export interface SessionSettings {
  /** Mukana olevat sävellajit (soundId) */
  sounds: readonly string[];
  distances: readonly DistanceLevel[];
  /** Sävellajin id (esim. "major:C") tai "random" */
  startKey: string;
}

/**
 * Harjoituskierre: lähtösävellaji on ensimmäinen tavoite, jonka jälkeen
 * jokainen onnistunut kadenssi arpoo uuden tavoitteen.
 */
export class PracticeSession {
  target: MusicKey;
  /** Aiemmat tavoitteet, uusin viimeisenä (viimeinen = sävellaji, josta nyt moduloidaan) */
  history: MusicKey[] = [];
  completed = 0;

  constructor(
    public settings: SessionSettings,
    private rng: () => number = Math.random,
  ) {
    this.target = this.initialKey();
  }

  private initialKey(): MusicKey {
    const chosen = this.settings.startKey !== "random" ? keyById(this.settings.startKey) : undefined;
    return chosen ?? pickNextKey({ ...this.settings, current: null, history: [], rng: this.rng });
  }

  advance(): MusicKey {
    const next = pickNextKey({
      sounds: this.settings.sounds,
      distances: this.settings.distances,
      current: this.target,
      history: this.history,
      rng: this.rng,
    });
    this.history.push(this.target);
    if (this.history.length > 10) this.history.shift();
    this.target = next;
    this.completed++;
    return next;
  }

  restart(settings: SessionSettings = this.settings): void {
    this.settings = settings;
    this.history = [];
    this.completed = 0;
    this.target = this.initialKey();
  }
}
