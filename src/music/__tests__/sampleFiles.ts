import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { SampleFile } from "../sample";

export const SAMPLES_DIR = fileURLToPath(new URL("../../../samples/", import.meta.url));

/** Lukee kaikki samples/-kansion testinäytteet (tiedostonimen mukaan järjestettynä). */
export function loadSampleFiles(dir = SAMPLES_DIR): { name: string; file: SampleFile }[] {
  let names: string[];
  try {
    names = readdirSync(dir).filter((n) => n.endsWith(".json")).sort();
  } catch {
    return [];
  }
  return names
    .map((name) => ({ name, file: JSON.parse(readFileSync(dir + name, "utf8")) as SampleFile }))
    .filter((s) => s.file.format === "modulaatiotreeni-sample");
}
