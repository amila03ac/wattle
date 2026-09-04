import { describe, it, expect } from "vitest";
import {
  parseWord,
  cloze,
  clozeSegments,
  isCorrectSpelling,
  pickSpellingSession,
  makeSum,
  makeSums,
  isCorrectSum,
} from "../src/content.js";
import type { MathRules } from "../src/state.js";

describe("parseWord", () => {
  it("reads a bare word", () => {
    expect(parseWord("because")).toEqual({ word: "because", sentence: "" });
  });
  it("splits a word from its sentence and trims", () => {
    expect(parseWord("  because | I was late because of the rain. ")).toEqual({
      word: "because",
      sentence: "I was late because of the rain.",
    });
  });
  it("keeps later pipes inside the sentence", () => {
    expect(parseWord("or | this | that").sentence).toBe("this | that");
  });
});

describe("cloze", () => {
  it("never leaks the spelling, which is the whole point of the clue", () => {
    const item = parseWord("because | I was late because of the rain.");
    expect(cloze(item)).toBe("I was late _____ of the rain.");
    expect(cloze(item).toLowerCase()).not.toContain("because");
  });
  it("blanks the word whatever its case", () => {
    expect(cloze(parseWord("water | Water is wet."))).toBe("_____ is wet.");
  });
  it("blanks every occurrence", () => {
    expect(cloze(parseWord("a | a b a"))).toBe("_____ b _____");
  });
  it("survives a word containing regex punctuation", () => {
    const item = parseWord("can't | I can't reach.");
    expect(() => cloze(item)).not.toThrow();
    expect(cloze(item)).toBe("I _____ reach.");
  });
  it("is empty with no sentence, so the UI can fall back", () => {
    expect(cloze(parseWord("because"))).toBe("");
    expect(clozeSegments(parseWord("because"))).toEqual([]);
  });
});

describe("clozeSegments", () => {
  it("marks which pieces are blanks so nothing goes through innerHTML", () => {
    expect(clozeSegments(parseWord("cat | The cat sat."))).toEqual([
      { text: "The ", blank: false },
      { text: "_____", blank: true },
      { text: " sat.", blank: false },
    ]);
  });
});

describe("isCorrectSpelling", () => {
  const item = parseWord("because | ...");
  it("ignores case and surrounding space", () => {
    expect(isCorrectSpelling("  BeCaUsE ", item)).toBe(true);
  });
  it("rejects a misspelling", () => {
    expect(isCorrectSpelling("becuase", item)).toBe(false);
  });
});

describe("pickSpellingSession", () => {
  const words = ["a", "b", "c", "d"];
  const noShuffle = <T>(xs: T[]): T[] => xs;

  it("puts missed words first, because the carry-forward is why misses matter", () => {
    expect(pickSpellingSession(words, ["c"], 4, noShuffle)).toEqual(["c", "a", "b", "d"]);
  });
  it("never repeats a missed word later in the same session", () => {
    const out = pickSpellingSession(words, ["c"], 4, noShuffle);
    expect(new Set(out).size).toBe(out.length);
  });
  it("drops missed words no longer on the list", () => {
    expect(pickSpellingSession(words, ["zzz"], 4, noShuffle)).toEqual(words);
  });
  it("caps the session length", () => {
    expect(pickSpellingSession(words, [], 2, noShuffle)).toHaveLength(2);
  });
});

describe("makeSum", () => {
  const check = (rules: MathRules, n = 400): void => {
    for (let i = 0; i < n; i++) {
      const s = makeSum(rules);
      const real = s.op === "+" ? s.a + s.b : s.a - s.b;
      expect(s.answer).toBe(real);
      expect(s.answer).toBeGreaterThanOrEqual(0);
      expect(Math.max(s.a, s.b, s.answer)).toBeLessThanOrEqual(rules.max);
      expect(s.a).toBeGreaterThan(1);
      expect(s.b).toBeGreaterThan(1);
    }
  };

  it("is arithmetically correct and in range for mixed work to 100", () => {
    check({ op: "mixed", max: 100, regroup: true });
  });
  it("never produces a negative answer", () => {
    for (let i = 0; i < 400; i++) expect(makeSum({ op: "sub", max: 100, regroup: true }).answer).toBeGreaterThanOrEqual(0);
  });
  it("honours a small range", () => {
    check({ op: "mixed", max: 20, regroup: false }, 200);
  });
  it("avoids carrying and borrowing when asked to keep it simple", () => {
    for (let i = 0; i < 400; i++) {
      const s = makeSum({ op: "mixed", max: 100, regroup: false });
      if (s.op === "+") expect((s.a % 10) + (s.b % 10)).toBeLessThanOrEqual(9);
      else expect(s.a % 10).toBeGreaterThanOrEqual(s.b % 10);
    }
  });
  it("favours regrouping when it is switched on, since those are worth practising", () => {
    let regrouped = 0;
    const total = 300;
    for (let i = 0; i < total; i++) {
      const s = makeSum({ op: "mixed", max: 100, regroup: true });
      const yes = s.op === "+" ? (s.a % 10) + (s.b % 10) > 9 : s.a % 10 < s.b % 10;
      if (yes) regrouped++;
    }
    expect(regrouped / total).toBeGreaterThan(0.5);
  });
  it("terminates even when the rules admit almost nothing", () => {
    const s = makeSum({ op: "add", max: 5, regroup: false });
    expect(s.answer).toBe(s.a + s.b);
  });
  it("makes the number of questions asked for", () => {
    expect(makeSums({ op: "add", max: 20, regroup: true }, 10)).toHaveLength(10);
  });
});

describe("isCorrectSum", () => {
  const sum = { a: 7, b: 5, op: "+" as const, answer: 12 };
  it("accepts the answer", () => expect(isCorrectSum("12", sum)).toBe(true));
  it("rejects a near miss", () => expect(isCorrectSum("13", sum)).toBe(false));
  it("rejects padding rather than silently accepting it", () => expect(isCorrectSum("012", sum)).toBe(false));
});
