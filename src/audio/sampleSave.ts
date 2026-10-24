import { chordAsciiLabel, type SampleFile } from "../music";

export interface SaveResult {
  /** "project" = kirjoitettu projektin samples/-kansioon, "download" = selaimen lataus */
  where: "project" | "download";
  name: string;
}

const INSTRUMENT_SLUG = { piano: "piano", organ: "urut", other: "muu" } as const;

export function sampleFileName(file: SampleFile): string {
  const d = new Date(file.createdAt);
  const pad = (n: number) => String(n).padStart(2, "0");
  const stamp = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  const what = file.meta.expected ? chordAsciiLabel(file.meta.expected) : "vapaa";
  return `${stamp}_${INSTRUMENT_SLUG[file.meta.instrument]}_${what}.json`;
}

/**
 * Kehityspalvelimessa (npm run dev) näyte kirjoitetaan suoraan projektin
 * samples/-kansioon. Muuten (tuotantoversio, puhelin) se ladataan tiedostona.
 */
export async function saveSample(file: SampleFile): Promise<SaveResult> {
  const name = sampleFileName(file);
  const body = JSON.stringify(file);
  if (import.meta.env.DEV) {
    try {
      const res = await fetch(`/api/samples?name=${encodeURIComponent(name)}`, { method: "POST", body, headers: { "Content-Type": "application/json" } });
      if (res.ok) return { where: "project", name: ((await res.json()) as { name: string }).name };
    } catch {
      // Palvelin ei vastaa: siirrytään lataukseen.
    }
  }
  const url = URL.createObjectURL(new Blob([body], { type: "application/json" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  return { where: "download", name };
}
