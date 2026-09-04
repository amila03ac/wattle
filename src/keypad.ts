import type { PadLayout } from "./state.js";

export const QWERTY_ROWS = ["qwertyuiop", "asdfghjkl", "zxcvbnm"];
export const ABC_ROWS = ["abcdefghi", "jklmnopqr", "stuvwxyz"];
export const DIGIT_ROWS = ["789", "456", "123"];

export function letterRows(layout: PadLayout): string[] {
  return layout === "abc" ? ABC_ROWS : QWERTY_ROWS;
}

/**
 * Every key is sized from the longest row and shorter rows are centred, so a
 * 7-key row has the same key size as a 10-key row. Letting each row stretch to
 * fill the width instead makes `zxcvbnm` visibly chunkier than `qwertyuiop`.
 */
export function widestRow(rows: string[]): number {
  return rows.reduce((n, r) => Math.max(n, r.length), 1);
}

export type KeyPress = { kind: "char"; value: string } | { kind: "delete" } | { kind: "submit" };

export function readKey(token: string): KeyPress {
  if (token === "del") return { kind: "delete" };
  if (token === "go") return { kind: "submit" };
  return { kind: "char", value: token };
}

/** Cap what can be typed: long enough for any real word, short enough to stay on one line. */
export const MAX_SPELLING_LEN = 18;
export const MAX_ANSWER_LEN = 4;
