export type ParsedNumberKind = "cardinal" | "fraction" | "mixed";

export interface ParsedNumber {
  value: number;
  raw: string;
  start: number;
  end: number;
  kind: ParsedNumberKind;
}

interface Token {
  normalized: string;
  raw: string;
  start: number;
  end: number;
}

const DEVANAGARI_DIGITS: Record<string, string> = {
  "०": "0",
  "१": "1",
  "२": "2",
  "३": "3",
  "४": "4",
  "५": "5",
  "६": "6",
  "७": "7",
  "८": "8",
  "९": "9"
};

const CARDINALS: Readonly<Record<string, number>> = {
  zero: 0,
  shunya: 0,
  "शून्य": 0,
  one: 1,
  ek: 1,
  "एक": 1,
  two: 2,
  do: 2,
  "दो": 2,
  three: 3,
  teen: 3,
  tin: 3,
  "तीन": 3,
  four: 4,
  chaar: 4,
  char: 4,
  "चार": 4,
  five: 5,
  paanch: 5,
  panch: 5,
  "पाँच": 5,
  "पांच": 5,
  six: 6,
  chhe: 6,
  cheh: 6,
  "छह": 6,
  seven: 7,
  saat: 7,
  sat: 7,
  "सात": 7,
  eight: 8,
  aath: 8,
  ath: 8,
  "आठ": 8,
  nine: 9,
  nau: 9,
  "नौ": 9,
  ten: 10,
  das: 10,
  "दस": 10,
  eleven: 11,
  gyarah: 11,
  "ग्यारह": 11,
  twelve: 12,
  barah: 12,
  "बारह": 12
};

const STANDALONE_FRACTIONS: Readonly<Record<string, number>> = {
  half: 0.5,
  aadha: 0.5,
  adha: 0.5,
  aadhi: 0.5,
  "आधा": 0.5,
  "आधी": 0.5,
  quarter: 0.25,
  chauthai: 0.25,
  "चौथाई": 0.25,
  pauna: 0.75,
  "पौना": 0.75,
  dedh: 1.5,
  "डेढ़": 1.5,
  "डेढ": 1.5,
  dhai: 2.5,
  "ढाई": 2.5,
  savaa: 1.25,
  sava: 1.25,
  sawa: 1.25,
  "सवा": 1.25
};

const TOKEN_PATTERN = /[\p{L}\p{M}\p{N}]+(?:[.,][\p{N}]+)?/gu;

function normalizeDigits(value: string): string {
  return [...value].map((character) => DEVANAGARI_DIGITS[character] ?? character).join("");
}

function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  for (const match of input.normalize("NFKC").toLocaleLowerCase("hi-IN").matchAll(TOKEN_PATTERN)) {
    const raw = match[0];
    const start = match.index;
    tokens.push({
      normalized: normalizeDigits(raw).replace(",", "."),
      raw,
      start,
      end: start + raw.length
    });
  }
  return tokens;
}

function tokenRange(input: string, tokens: readonly Token[], start: number, length: number): Pick<ParsedNumber, "raw" | "start" | "end"> {
  const first = tokens[start];
  const last = tokens[start + length - 1];
  if (!first || !last) {
    throw new RangeError("Invalid bilingual-number token range");
  }
  return {
    raw: input.slice(first.start, last.end),
    start: first.start,
    end: last.end
  };
}

function cardinalValue(token: Token | undefined): number | undefined {
  if (!token) return undefined;
  if (/^\d+(?:\.\d+)?$/u.test(token.normalized)) return Number(token.normalized);
  return CARDINALS[token.normalized];
}

/** Extracts English, Devanagari Hindi, and romanized-Hindi quantities in reading order. */
export function parseBilingualNumbers(input: string): ParsedNumber[] {
  const tokens = tokenize(input);
  const results: ParsedNumber[] = [];

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (!token) continue;
    const word = token.normalized;
    const next = tokens[index + 1];
    const afterNext = tokens[index + 2];
    const fourth = tokens[index + 3];

    const isEnglishOneAndHalf = word === "one" && next?.normalized === "and" && afterNext?.normalized === "a" && fourth?.normalized === "half";
    const isHindiOneAndHalf = (word === "ek" || word === "एक") && (next?.normalized === "aur" || next?.normalized === "और") && ["aadha", "adha", "आधा"].includes(afterNext?.normalized ?? "");
    if (isEnglishOneAndHalf || isHindiOneAndHalf) {
      const length = isEnglishOneAndHalf ? 4 : 3;
      results.push({ value: 1.5, kind: "mixed", ...tokenRange(input, tokens, index, length) });
      index += length - 1;
      continue;
    }

    if (["paune", "पौने"].includes(word)) {
      const base = cardinalValue(next);
      if (base !== undefined && base >= 1) {
        results.push({ value: base - 0.25, kind: "mixed", ...tokenRange(input, tokens, index, 2) });
        index += 1;
        continue;
      }
    }

    if (["savaa", "sava", "sawa", "सवा"].includes(word)) {
      const base = cardinalValue(next);
      if (base !== undefined && base >= 1) {
        results.push({ value: base + 0.25, kind: "mixed", ...tokenRange(input, tokens, index, 2) });
        index += 1;
        continue;
      }
    }

    if (["saadhe", "sadhe", "साढ़े", "साढे"].includes(word)) {
      const base = cardinalValue(next);
      if (base !== undefined && base >= 1) {
        results.push({ value: base + 0.5, kind: "mixed", ...tokenRange(input, tokens, index, 2) });
        index += 1;
        continue;
      }
    }

    const numericValue = cardinalValue(token);
    if (numericValue !== undefined) {
      results.push({
        value: numericValue,
        kind: Number.isInteger(numericValue) ? "cardinal" : "mixed",
        ...tokenRange(input, tokens, index, 1)
      });
      continue;
    }

    const fractionValue = STANDALONE_FRACTIONS[word];
    if (fractionValue !== undefined) {
      results.push({ value: fractionValue, kind: fractionValue < 1 ? "fraction" : "mixed", ...tokenRange(input, tokens, index, 1) });
    }
  }

  return results;
}

export function parseFirstBilingualNumber(input: string): ParsedNumber | undefined {
  return parseBilingualNumbers(input)[0];
}
