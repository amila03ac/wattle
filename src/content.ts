import type { MathRules } from "./state.js";

/* ---------------------------------------------------------------- spelling */

export interface SpellingItem {
  /** The word the learner must produce. */
  word: string;
  /** Optional sentence using the word, read aloud and shown with a gap. */
  sentence: string;
}

const RX_SPECIAL = /[.*+?^${}()|[\]\\]/g;

/** A line is "word" or "word | a sentence using the word". */
export function parseWord(line: string): SpellingItem {
  const parts = String(line).split("|");
  return {
    word: (parts[0] ?? "").trim(),
    sentence: parts.slice(1).join("|").trim(),
  };
}

/**
 * The sentence with the word punched out. This is the clue when speech is
 * unavailable. It must never reveal the spelling, only the meaning.
 */
export function cloze(item: SpellingItem, blank = "_____"): string {
  if (!item.sentence || !item.word) return "";
  try {
    return item.sentence.replace(new RegExp(item.word.replace(RX_SPECIAL, "\\$&"), "gi"), blank);
  } catch {
    return item.sentence;
  }
}

/**
 * The clue split into pieces, so the caller can build it from DOM nodes.
 * Sentences are typed by a parent, so they are never fed to innerHTML.
 */
export function clozeSegments(item: SpellingItem): { text: string; blank: boolean }[] {
  if (!item.sentence || !item.word) return [];
  let rx: RegExp;
  try {
    rx = new RegExp(item.word.replace(RX_SPECIAL, "\\$&"), "gi");
  } catch {
    return [{ text: item.sentence, blank: false }];
  }
  const out: { text: string; blank: boolean }[] = [];
  let last = 0;
  for (const m of item.sentence.matchAll(rx)) {
    const at = m.index ?? 0;
    if (at > last) out.push({ text: item.sentence.slice(last, at), blank: false });
    out.push({ text: "_____", blank: true });
    last = at + m[0].length;
  }
  if (last < item.sentence.length) out.push({ text: item.sentence.slice(last), blank: false });
  return out;
}

export function isCorrectSpelling(typed: string, item: SpellingItem): boolean {
  return typed.trim().toLowerCase() === item.word.trim().toLowerCase();
}

/**
 * Build a session. Missed words come first. That carry-forward is the whole
 * reason a word answered wrongly is worth setting again the next day.
 */
export function pickSpellingSession(
  words: string[],
  missed: string[],
  count = 10,
  shuffle: <T>(xs: T[]) => T[] = shuffleInPlace,
): string[] {
  const live = missed.filter((m) => words.includes(m));
  const rest = shuffle(words.filter((w) => !live.includes(w)));
  return [...live, ...rest].slice(0, count);
}

function shuffleInPlace<T>(xs: T[]): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const ai = a[i]!, aj = a[j]!;
    a[i] = aj;
    a[j] = ai;
  }
  return a;
}

/* ------------------------------------------------------------------- maths */

export interface Sum {
  a: number;
  b: number;
  /** Display symbol: a real minus sign, not a hyphen. */
  op: "+" | "−";
  answer: number;
}

/**
 * Questions are generated from rules, so a parent never types a sum. Rejection
 * sampling keeps this readable; the fallback below guarantees termination.
 *
 * Rules enforced: the answer is never negative, never trivial (no 0 or 1
 * operands, no a - a), and stays within `max`. When regrouping is on and the
 * range is wide enough to make it meaningful, questions that actually carry or
 * borrow are favoured, since those are the ones worth practising.
 */
export function makeSum(rules: MathRules, rand: () => number = Math.random): Sum {
  const pick = (n: number) => 1 + Math.floor(rand() * n);
  const op = rules.op === "mixed" ? (rand() < 0.5 ? "add" : "sub") : rules.op;
  const wantsRegroupBias = rules.regroup && rules.max > 20;

  for (let i = 0; i < 500; i++) {
    if (op === "add") {
      const a = pick(Math.max(2, rules.max - 2));
      const b = pick(Math.max(2, rules.max - a));
      if (a < 2 || b < 2 || a + b > rules.max) continue;
      const carries = (a % 10) + (b % 10) > 9;
      if (!rules.regroup && carries) continue;
      if (wantsRegroupBias && !carries && rand() < 0.6) continue;
      return { a, b, op: "+", answer: a + b };
    }
    const a = pick(rules.max);
    const b = pick(Math.max(1, a - 1));
    if (b < 2 || a - b < 1) continue;
    const borrows = a % 10 < b % 10;
    if (!rules.regroup && borrows) continue;
    if (wantsRegroupBias && !borrows && rand() < 0.6) continue;
    return { a, b, op: "−", answer: a - b };
  }

  // Only reachable if the rules admit almost nothing (a very small max).
  return op === "add"
    ? { a: 2, b: 3, op: "+", answer: 5 }
    : { a: 5, b: 2, op: "−", answer: 3 };
}

export function makeSums(rules: MathRules, count = 10, rand: () => number = Math.random): Sum[] {
  return Array.from({ length: count }, () => makeSum(rules, rand));
}

export function isCorrectSum(typed: string, sum: Sum): boolean {
  return typed.trim() === String(sum.answer);
}
