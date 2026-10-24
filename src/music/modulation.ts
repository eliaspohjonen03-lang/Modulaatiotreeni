import { Key, Note } from "tonal";
import { fifthsDistance, keyDisplayName, soundId, spellingsOf, type MusicKey } from "./keys";
import { finnishNoteName, mod12, nameToPc } from "./notes";

/**
 * Modulaatiovinkit: sointureitit edellisestä sävellajista uuteen.
 * Reitit lasketaan säännöillä (ei käsin kirjoitettu taulukko), helpoin ensin.
 * Jokainen reitti päättyy tavoitteen kadenssiin V7 → I, jonka sovellus tunnistaa.
 */

export type RouteChordKind = "maj" | "min" | "dim" | "7" | "dim7";

/** Sointu kirjoitusasuineen, esim. { root: "E#", kind: "dim7" } = Eis°7 */
export interface SpelledChord {
  root: string;
  kind: RouteChordKind;
}

export interface RouteStep {
  chord: SpelledChord;
  /** Aste lähtösävellajissa, esim. "vi" */
  from?: string;
  /** Aste tavoitesävellajissa, esim. "ii" */
  to?: string;
  /** Enharmoninen uudelleenkirjoitus tavoitesävellajissa (esim. H°7 = Eis°7) */
  respelled?: SpelledChord;
}

export type Technique = "pivot" | "neapolitan" | "parallel" | "dim7" | "tritone" | "direct";

export interface ModulationRoute {
  technique: Technique;
  title: string;
  steps: RouteStep[];
  explanation: string;
  /** Pienempi = helpompi */
  rank: number;
}

const INTERVALS: Record<RouteChordKind, string[]> = {
  maj: ["1P", "3M", "5P"],
  min: ["1P", "3m", "5P"],
  dim: ["1P", "3m", "5d"],
  "7": ["1P", "3M", "5P", "7m"],
  dim7: ["1P", "3m", "5d", "7d"],
};

const SUFFIX: Record<RouteChordKind, string> = { maj: "", min: "m", dim: "°", "7": "7", dim7: "°7" };

export const chordNotes = (c: SpelledChord): string[] => INTERVALS[c.kind].map((iv) => Note.transpose(c.root, iv));
export const chordPcs = (c: SpelledChord): number[] => chordNotes(c).map(nameToPc);
export const spelledChordLabel = (c: SpelledChord): string => finnishNoteName(c.root) + SUFFIX[c.kind];

const samePcs = (a: SpelledChord, b: SpelledChord): boolean => {
  const x = chordPcs(a).sort((p, q) => p - q);
  const y = chordPcs(b).sort((p, q) => p - q);
  return x.length === y.length && x.every((p, i) => p === y[i]);
};
const sameChord = (a: SpelledChord, b: SpelledChord) => a.kind === b.kind && samePcs(a, b);

interface Degree {
  roman: string;
  chord: SpelledChord;
}

/** Duurissa asteikko, mollissa luonnollinen (III, VI, VII) ja harmoninen (V, vii°). */
function scales(k: MusicKey): { natural: string[]; harmonic: string[] } {
  if (k.mode === "major") {
    const s = [...Key.majorKey(k.tonic).scale];
    return { natural: s, harmonic: s };
  }
  const m = Key.minorKey(k.tonic);
  return { natural: [...m.natural.scale], harmonic: [...m.harmonic.scale] };
}

/** Siltasoinnuiksi kelpaavat kolmisoinnut (vähennetyt pois). */
function triads(k: MusicKey): Degree[] {
  const { natural: n, harmonic: h } = scales(k);
  if (k.mode === "major") {
    return [
      { roman: "I", chord: { root: n[0], kind: "maj" } },
      { roman: "ii", chord: { root: n[1], kind: "min" } },
      { roman: "iii", chord: { root: n[2], kind: "min" } },
      { roman: "IV", chord: { root: n[3], kind: "maj" } },
      { roman: "V", chord: { root: n[4], kind: "maj" } },
      { roman: "vi", chord: { root: n[5], kind: "min" } },
    ];
  }
  return [
    { roman: "i", chord: { root: n[0], kind: "min" } },
    { roman: "III", chord: { root: n[2], kind: "maj" } },
    { roman: "iv", chord: { root: n[3], kind: "min" } },
    { roman: "V", chord: { root: h[4], kind: "maj" } },
    { roman: "VI", chord: { root: n[5], kind: "maj" } },
    { roman: "VII", chord: { root: n[6], kind: "maj" } },
  ];
}

const tonic = (k: MusicKey): Degree => triads(k)[0];
export const dominant7 = (k: MusicKey): Degree => ({ roman: "V7", chord: { root: scales(k).harmonic[4], kind: "7" } });
const leadingDim7 = (k: MusicKey): Degree => ({ roman: "vii°7", chord: { root: scales(k).harmonic[6], kind: "dim7" } });
const neapolitan = (k: MusicKey): SpelledChord => ({ root: Note.transpose(k.tonic, "2m"), kind: "maj" });

/** Vähennetyt septimisoinnut: vii°7 ja välijohtosävelsoinnut. Yhdessä ne kattavat kaikki 12 sävellajia. */
function dim7Chords(k: MusicKey): Degree[] {
  const n = scales(k).natural;
  const lt = (root: string): SpelledChord => ({ root: Note.transpose(root, "-2m"), kind: "dim7" });
  const third = k.mode === "major" ? { roman: "vii°7/ii", chord: lt(n[1]) } : { roman: "vii°7/iv", chord: lt(n[3]) };
  return [leadingDim7(k), { roman: "vii°7/V", chord: lt(n[4]) }, third];
}

/** Tavoitteen asteen sopivuus siltasoinnuksi: subdominanttitehot parhaita. */
function pivotScore(roman: string): number {
  const scores: Record<string, number> = { ii: 0, IV: 0, iv: 0, VI: 0, vi: 1, III: 1, V: 1.5, iii: 2, I: 2, i: 2, VII: 2 };
  return scores[roman] ?? 3;
}

const genitive = (k: MusicKey) => `${keyDisplayName(k)}n`;

/** Samanniminen sävellaji (sama toonika, eri moodi) yksinkertaisimmalla kirjoitusasulla. */
function parallelKey(k: MusicKey): MusicKey {
  return spellingsOf(`${k.mode === "major" ? "minor" : "major"}:${k.pc}`)[0];
}

/** Lopetus: tavoitteen V7 → I (jätetään pois V7, jos edellinen askel jo on se). */
function cadence(to: MusicKey, prev: RouteStep): RouteStep[] {
  const v7 = dominant7(to);
  const i = tonic(to);
  const out: RouteStep[] = [];
  if (!(sameChord(prev.chord, v7.chord))) out.push({ chord: v7.chord, to: v7.roman });
  out.push({ chord: i.chord, to: i.roman });
  return out;
}

/** Siltasointureitit kahden sävellajin välillä (yhteinen kolmisointu). */
function pivots(from: MusicKey, to: MusicKey): { f: Degree; t: Degree; score: number }[] {
  const out: { f: Degree; t: Degree; score: number }[] = [];
  for (const f of triads(from)) {
    for (const t of triads(to)) {
      if (!sameChord(f.chord, t.chord)) continue;
      if (t.roman === "I" || t.roman === "i") {
        if (f.roman === "I" || f.roman === "i") continue;
      }
      // Pidempi reitti (siltasointu ei ole lähtösävellajin I) on hieman vaikeampi.
      out.push({ f, t, score: pivotScore(t.roman) + (f.roman === "I" || f.roman === "i" ? 0 : 0.25) });
    }
  }
  return out.sort((a, b) => a.score - b.score);
}

function pivotSteps(from: MusicKey, f: Degree, t: Degree): RouteStep[] {
  const start = tonic(from);
  if (f.roman === start.roman) return [{ chord: f.chord, from: f.roman, to: t.roman }];
  return [{ chord: start.chord, from: start.roman }, { chord: f.chord, from: f.roman, to: t.roman }];
}

export function modulationRoutes(from: MusicKey, to: MusicKey): ModulationRoute[] {
  const routes: ModulationRoute[] = [];
  const start = tonic(from);
  const startStep: RouteStep = { chord: start.chord, from: start.roman };
  const add = (r: Omit<ModulationRoute, "steps"> & { steps: RouteStep[] }) => {
    r.steps = [...r.steps, ...cadence(to, r.steps[r.steps.length - 1])];
    routes.push(r);
  };

  // 1. Yhteinen sointu
  const p = pivots(from, to)[0];
  if (p) {
    add({
      technique: "pivot",
      title: "Yhteinen sointu",
      rank: p.score,
      steps: pivotSteps(from, p.f, p.t),
      explanation: `${spelledChordLabel(p.f.chord)} on ${genitive(from)} ${p.f.roman} ja ${genitive(to)} ${p.t.roman}.`,
    });
  }

  // 2. Napolilainen sointu: lähtösävellajin sointu on tavoitteen ♭II
  const n = neapolitan(to);
  const nf = triads(from).find((d) => sameChord(d.chord, n));
  if (nf) {
    add({
      technique: "neapolitan",
      title: "Napolilainen sointu",
      rank: 2 + (nf.roman === start.roman ? 0 : 0.25),
      steps: pivotSteps(from, nf, { roman: "♭II", chord: n }),
      explanation: `${spelledChordLabel(nf.chord)} on ${genitive(to)} napolilainen sointu (♭II). Soita se mieluiten terssi bassossa.`,
    });
  }

  // 3. Samannimisen sävellajin kautta (esim. C-duuri → c-molli avaa alennuspuolen)
  const par = parallelKey(from);
  if (soundId(par) !== soundId(to)) {
    const pp = pivots(par, to)[0];
    if (pp) {
      const parTonic = tonic(par);
      const steps: RouteStep[] = [startStep, { chord: parTonic.chord, from: parTonic.roman }];
      if (pp.f.roman !== parTonic.roman) steps.push({ chord: pp.f.chord, from: pp.f.roman, to: pp.t.roman });
      else steps[1].to = pp.t.roman;
      add({
        technique: "parallel",
        title: "Samannimisen sävellajin kautta",
        rank: 3 + pp.score,
        steps,
        explanation: `Vaihda ensin ${keyDisplayName(par)}in. ${spelledChordLabel(pp.f.chord)} on ${genitive(par)} ${pp.f.roman} ja ${genitive(to)} ${pp.t.roman}.`,
      });
    }
  } else {
    // Tavoite on samanniminen sävellaji itse: toonika vaihtaa moodia.
    add({
      technique: "parallel",
      title: "Samanniminen sävellaji",
      rank: 1,
      steps: [startStep],
      explanation: `Sama toonika, eri moodi: ${keyDisplayName(to)} on ${genitive(from)} samanniminen sävellaji.`,
    });
  }

  // 4. Vähennetty septimisointu kirjoitetaan uudelleen tavoitteen vii°7:ksi
  const target = leadingDim7(to);
  const df = dim7Chords(from).find((d) => samePcs(d.chord, target.chord));
  if (df) {
    const same = Note.get(df.chord.root).letter === Note.get(target.chord.root).letter && nameToPc(df.chord.root) === nameToPc(target.chord.root);
    add({
      technique: "dim7",
      title: "Vähennetty septimisointu",
      rank: df.roman === "vii°7" ? 4.5 : 5,
      steps: [startStep, { chord: df.chord, from: df.roman, to: target.roman, respelled: same ? undefined : target.chord }],
      explanation: same
        ? `${spelledChordLabel(df.chord)} on ${genitive(from)} ${df.roman} ja samalla ${genitive(to)} ${target.roman}.`
        : `${spelledChordLabel(df.chord)} (${genitive(from)} ${df.roman}) kirjoitetaan uudelleen muotoon ${spelledChordLabel(target.chord)} = ${genitive(to)} ${target.roman}.`,
    });
  }

  // 5. Tritonussijainen: lähtösävellajin V7 = tavoitteen ♭II7 (vain tritonusetäisyydellä)
  if (mod12(to.pc - from.pc) === 6) {
    const v7 = dominant7(from);
    const t = tonic(to);
    add({
      technique: "tritone",
      title: "Tritonussijainen",
      rank: 5.5,
      steps: [startStep, { chord: v7.chord, from: v7.roman, to: "♭II7" }, { chord: t.chord, to: t.roman }],
      explanation: `${genitive(from)} V7 (${spelledChordLabel(v7.chord)}) on myös ${genitive(to)} tritonussijainen dominantti: se purkautuu puolisävelaskeleen alas uuteen toonikaan. Vahvista lopuksi kadenssilla.`,
    });
  }

  // 6. Suoraan dominanttiin (aina mahdollinen, kauempana äkillinen)
  const v7 = dominant7(to);
  // Välidominantti: dominantti ja sen purkaussävel ovat molemmat lähtösävellajin asteikon säveliä (esim. C → D: A7).
  const scalePcs = scales(from).natural.map(nameToPc);
  const inScale = scalePcs.includes(nameToPc(v7.chord.root)) && scalePcs.includes(to.pc);
  add({
    technique: "direct",
    title: "Suoraan dominanttiin",
    rank: inScale ? 2.5 : 6,
    steps: [startStep],
    explanation: inScale
      ? `${spelledChordLabel(v7.chord)} on ${genitive(from)} tuttu välidominantti, joten siirtymä kuulostaa luontevalta.`
      : `Siirry suoraan ${genitive(to)} dominanttiin. Toimii aina, mutta kuulostaa äkilliseltä.`,
  });

  return routes.sort((a, b) => a.rank - b.rank);
}

/** Ensimmäinen tavoite (ei edellistä sävellajia): kadenssi I – IV – V7 – I. */
export function startRoute(to: MusicKey): ModulationRoute {
  const t = triads(to);
  const sub = t.find((d) => d.roman === "IV" || d.roman === "iv")!;
  return {
    technique: "direct",
    title: "Kadenssi",
    rank: 0,
    steps: [
      { chord: t[0].chord, to: t[0].roman },
      { chord: sub.chord, to: sub.roman },
      { chord: dominant7(to).chord, to: "V7" },
      { chord: t[0].chord, to: t[0].roman },
    ],
    explanation: `Vahvista lähtösävellaji kadenssilla.`,
  };
}

/** Etäisyyden kuvaus, esim. "Tritonus · 6 askelta · vaikea" */
export function distanceText(from: MusicKey, to: MusicKey): string {
  const d = fifthsDistance(from, to);
  if (d === 0) return "Rinnakkaissävellaji · samat etumerkit";
  const steps = `${d} ${d === 1 ? "askel" : "askelta"} kvinttiympyrällä`;
  if (from.pc === to.pc) return `Samanniminen sävellaji · ${steps}`;
  if (d === 1) return `Lähisävellaji · ${steps}`;
  if (d <= 3) return `${steps} · keskitaso`;
  return `${d === 6 ? "Tritonus · " : ""}${steps} · vaikea`;
}
