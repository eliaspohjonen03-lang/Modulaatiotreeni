import { beforeEach, describe, expect, it } from "vitest";
import { soundsWithAccidentals } from "./music";
import { DEFAULT_SETTINGS, loadSettings, saveSettings } from "./settings";

const store = new Map<string, string>();
(globalThis as { localStorage?: unknown }).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
};
const KEY = "modulaatiotreeni.settings.v1";

describe("asetusten tallennus", () => {
  beforeEach(() => store.clear());

  it("oletukset, kun mitään ei ole tallennettu", () => {
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it("v2 → v3: etumerkkitaso ja moodi muuttuvat sävellajivalinnaksi, muut asetukset säilyvät", () => {
    store.set(KEY, JSON.stringify({ v: 2, level: "medium", modes: "minor", bpm: 96, harmonicSuppression: 0.2 }));
    const s = loadSettings();
    expect(s.sounds).toEqual(soundsWithAccidentals(3, 4).filter((x) => x.startsWith("minor")));
    expect(s.distances).toEqual(["near", "medium", "far"]);
    expect(s.bpm).toBe(96);
    expect(s.harmonicSuppression).toBe(0.2);
    expect("level" in s).toBe(false);
  });

  it("v1: vanha yläsävelvaimennus korvataan oletuksella", () => {
    store.set(KEY, JSON.stringify({ level: "easy", modes: "both", harmonicSuppression: 0.6 }));
    const s = loadSettings();
    expect(s.harmonicSuppression).toBe(DEFAULT_SETTINGS.harmonicSuppression);
    expect(s.sounds).toEqual(soundsWithAccidentals(0, 2));
  });

  it("tallennus ja luku säilyttävät valinnat", () => {
    saveSettings({ ...DEFAULT_SETTINGS, sounds: ["major:0", "minor:9"], distances: ["near", "medium"] });
    expect(loadSettings()).toMatchObject({ sounds: ["major:0", "minor:9"], distances: ["near", "medium"] });
  });

  it("v3 → v4: yksi etäisyystaso muuttuu listaksi", () => {
    store.set(KEY, JSON.stringify({ v: 3, sounds: ["major:0"], distance: "far" }));
    expect(loadSettings().distances).toEqual(["far"]);
    store.set(KEY, JSON.stringify({ v: 3, sounds: ["major:0"], distance: "all" }));
    expect(loadSettings().distances).toEqual(["near", "medium", "far"]);
  });
});
