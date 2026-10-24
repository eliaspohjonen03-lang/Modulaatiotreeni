import { describe, expect, it } from "vitest";
import { finnishNoteName, pcToName } from "../notes";

describe("suomalaiset sävelnimet", () => {
  it.each([
    ["C", "C"], ["B", "H"], ["Bb", "B"], ["F#", "Fis"], ["C#", "Cis"], ["Eb", "Es"], ["Ab", "As"],
    ["Db", "Des"], ["Gb", "Ges"], ["Cb", "Ces"], ["E#", "Eis"], ["B#", "His"], ["A#", "Ais"], ["Bbb", "Heses"],
  ])("%s → %s", (input, expected) => expect(finnishNoteName(input)).toBe(expected));

  it("sävelluokan nimi ylennyksin ja alennuksin", () => {
    expect(pcToName(10)).toBe("A#");
    expect(pcToName(10, true)).toBe("Bb");
  });
});
