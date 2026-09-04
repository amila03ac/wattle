import { describe, it, expect } from "vitest";
import { letterRows, widestRow, readKey, QWERTY_ROWS, ABC_ROWS } from "../src/keypad.js";

describe("keypad layouts", () => {
  it("covers the alphabet exactly once, either way round", () => {
    for (const rows of [QWERTY_ROWS, ABC_ROWS]) {
      const letters = rows.join("").split("").sort().join("");
      expect(letters).toBe("abcdefghijklmnopqrstuvwxyz");
    }
  });
  it("picks the layout that was asked for", () => {
    expect(letterRows("abc")).toBe(ABC_ROWS);
    expect(letterRows("qwerty")).toBe(QWERTY_ROWS);
  });

  // Sizing every key from the longest row is what stops `zxcvbnm` rendering
  // chunkier than `qwertyuiop`.
  it("reports the longest row so every key gets one width", () => {
    expect(widestRow(QWERTY_ROWS)).toBe(10);
    expect(widestRow(ABC_ROWS)).toBe(9);
  });
});

describe("readKey", () => {
  it("reads letters, delete and submit", () => {
    expect(readKey("q")).toEqual({ kind: "char", value: "q" });
    expect(readKey("del")).toEqual({ kind: "delete" });
    expect(readKey("go")).toEqual({ kind: "submit" });
  });
});
