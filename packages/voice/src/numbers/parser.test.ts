import { describe, expect, it } from "vitest";
import { parseBilingualNumbers, parseFirstBilingualNumber } from "./parser.js";

describe("parseBilingualNumbers", () => {
  it("extracts English, romanized Hindi, and Devanagari numbers", () => {
    expect(parseBilingualNumbers("do chammach, आधा cup aur ३ seeti").map(({ value }) => value)).toEqual([2, 0.5, 3]);
  });

  it("handles common andaaz mixed quantities", () => {
    expect(parseFirstBilingualNumber("सवा दो katori")?.value).toBe(2.25);
    expect(parseFirstBilingualNumber("paune teen glass")?.value).toBe(2.75);
    expect(parseFirstBilingualNumber("साढ़े ३ minute")?.value).toBe(3.5);
    expect(parseFirstBilingualNumber("one and a half spoon")?.value).toBe(1.5);
  });

  it("preserves the source span", () => {
    expect(parseFirstBilingualNumber("बस ढाई मिनट और")).toMatchObject({ raw: "ढाई", value: 2.5, start: 3, end: 6 });
  });
});
