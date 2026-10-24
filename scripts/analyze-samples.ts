/**
 * Testinäytteiden analyysi: ajaa jokaisen samples/-kansion näytteen tunnistuksen läpi
 * ja tulostaa, miten hyvin odotettu sointu tunnistui.
 *
 *   npm run samples                         oletusasetuksilla
 *   npm run samples -- --minChordScore=0.7 --agreement=0.6 --harmonicSuppression=0.3
 *   npm run samples -- --saved              tallennushetken asetuksilla
 *   npm run samples -- --frames=nimi        kehyskohtainen erittely tiedostoista, joiden nimessä on "nimi"
 */
import { chordLabel, finnishNoteName, pcToName, replaySample, type Chord, type ChromaOptions, type TrackerOptions } from "../src/music";
import { loadSampleFiles } from "../src/music/__tests__/sampleFiles";

const args = new Map(
  process.argv.slice(2).filter((a) => a.startsWith("--")).map((a) => {
    const [k, v] = a.slice(2).split("=");
    return [k, v ?? "true"] as const;
  }),
);
const num = (k: string) => (args.has(k) ? Number(args.get(k)) : undefined);

const chroma: Partial<ChromaOptions> = {};
const tracker: Partial<TrackerOptions> = {};
if (num("harmonicSuppression") !== undefined) chroma.harmonicSuppression = num("harmonicSuppression");
if (num("bassRatio") !== undefined) chroma.bassRatio = num("bassRatio");
for (const k of ["minChordScore", "agreement", "smoothingMs", "minChordMs"] as const) {
  if (num(k) !== undefined) tracker[k] = num(k)!;
}
const thresholdDb = num("thresholdDb");
const framesFilter = args.get("frames");

const name = (c: Chord | null) => (c ? chordLabel(c) : "–");
const pcName = (pc: number) => finnishNoteName(pcToName(pc, [3, 8, 10].includes(pc)));
const pad = (s: string, n: number) => s.padEnd(n).slice(0, n);

const samples = loadSampleFiles();
if (samples.length === 0) {
  console.log("samples/-kansiossa ei ole näytteitä. Tallenna niitä: Asetukset → Testinäytteet.");
  process.exit(0);
}

let ok = 0;
let withChord = 0;
console.log(`${pad("näyte", 44)} ${pad("soitin", 7)} ${pad("odotettu", 8)} ${pad("oikein", 7)} ${pad("väärin", 7)} ${pad("vakaa", 7)} vakaat soinnut`);
for (const { name: file, file: sample } of samples) {
  const { frames, summary } = replaySample(sample, { defaults: !args.has("saved"), chroma, tracker, thresholdDb });
  const exp = sample.meta.expected;
  const pct = (n: number) => (summary.framesAbove ? `${Math.round((100 * n) / summary.framesAbove)} %` : "–");
  if (exp) {
    withChord++;
    if (summary.stableAfterMs !== null) ok++;
  }
  console.log(
    `${pad(file, 44)} ${pad(sample.meta.instrument, 7)} ${pad(exp ? name(exp) : "vapaa", 8)} ${pad(exp ? pct(summary.framesCorrect) : "", 7)} ${pad(exp ? pct(summary.framesWrong) : "", 7)} ${pad(summary.stableAfterMs === null ? (exp ? "EI" : "") : `${(summary.stableAfterMs / 1000).toFixed(1)} s`, 7)} ${summary.stableSequence.map(name).join(" → ")}`,
  );

  if (framesFilter && file.includes(framesFilter)) {
    console.log(`  ${sample.meta.registration} ${sample.meta.notes}`.trimEnd());
    for (const f of frames) {
      const top = f.chroma
        ? f.chroma.map((v, pc) => [pc, v] as const).filter(([, v]) => v >= 0.2).sort((a, b) => b[1] - a[1]).map(([pc, v]) => `${pcName(pc)}${v.toFixed(2)}`).join(" ")
        : "";
      const score = f.instant ? ` (${f.instant.score.toFixed(2)})` : "";
      console.log(`  ${String(f.t).padStart(5)} ms ${f.level.toFixed(1).padStart(6)} dB ${f.above ? "▮" : " "} basso ${pad(f.bass === null ? "–" : pcName(f.bass), 3)} ${pad(name(f.instant) + score, 14)} vakaa ${pad(name(f.stable), 6)} ${top}`);
    }
  }
}
if (withChord) console.log(`\nVakaaksi tunnistui ${ok}/${withChord} sointunäytettä.`);
