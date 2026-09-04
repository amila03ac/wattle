import { describe, it, expect } from "vitest";
import { parseSave, freshSave, rollWeek, cleanName, SCHEMA_VERSION, MAX_NAME_LEN } from "../src/state.js";

describe("parseSave", () => {
  it("starts fresh with nothing stored", () => {
    expect(parseSave(null).stars).toBe(0);
    expect(parseSave(null).words.length).toBeGreaterThan(0);
  });

  it("starts fresh rather than throwing on rubbish", () => {
    expect(() => parseSave("{not json")).not.toThrow();
    expect(parseSave("{not json").stars).toBe(0);
    expect(parseSave("null").stars).toBe(0);
    expect(parseSave("[1,2,3]").stars).toBe(0);
  });

  it("keeps a real save", () => {
    const save = { ...freshSave(), stars: 42.5, words: ["cat", "dog"] };
    const back = parseSave(JSON.stringify(save));
    expect(back.stars).toBe(42.5);
    expect(back.words).toEqual(["cat", "dog"]);
  });

  it("stamps the current schema version so migrations have something to read", () => {
    expect(parseSave(JSON.stringify({ stars: 5 })).v).toBe(SCHEMA_VERSION);
  });

  it("repairs a half-written save instead of losing the stars", () => {
    const back = parseSave(JSON.stringify({ stars: 30, words: null, math: { op: "nonsense", max: -5 } }));
    expect(back.stars).toBe(30);
    expect(back.words.length).toBeGreaterThan(0);
    expect(back.math.op).toBe("mixed");
    expect(back.math.max).toBe(100);
  });

  it("refuses a negative star count", () => {
    expect(parseSave(JSON.stringify({ stars: -99 })).stars).toBe(0);
  });

  it("drops junk out of the word list and the weekday list", () => {
    const back = parseSave(JSON.stringify({ words: ["ok", "", 7, null], week: { days: [0, 9, "x"] } }));
    expect(back.words).toEqual(["ok"]);
    expect(back.week.days).toEqual([0]);
  });
});

describe("names", () => {
  it("keeps a name and trims stray whitespace", () => {
    expect(cleanName("  Robin  ")).toBe("Robin");
    expect(cleanName("Anna   Maria")).toBe("Anna Maria");
  });
  it("treats anything that is not a string as no name", () => {
    for (const junk of [null, undefined, 42, {}, []]) expect(cleanName(junk)).toBe("");
  });
  it("caps the length so the greeting stays on one line", () => {
    expect(cleanName("x".repeat(200))).toHaveLength(MAX_NAME_LEN);
  });
  it("defaults to no name, so the app works before anyone sets one", () => {
    expect(freshSave().learnerName).toBe("");
    expect(freshSave().voiceURI).toBe("");
  });
});

describe("migrating a v1 save", () => {
  // The point of the version field: an older save must survive intact.
  const v1 = JSON.stringify({
    v: 1,
    words: ["cat", "dog"],
    missed: ["cat"],
    math: { op: "add", max: 50, regroup: false },
    layout: "abc",
    stars: 37.5,
    week: { start: "2026-08-31", stars: 4, days: [0, 2] },
  });

  it("keeps every earned star and every setting", () => {
    const out = parseSave(v1);
    expect(out.stars).toBe(37.5);
    expect(out.words).toEqual(["cat", "dog"]);
    expect(out.missed).toEqual(["cat"]);
    expect(out.math).toEqual({ op: "add", max: 50, regroup: false });
    expect(out.layout).toBe("abc");
  });

  it("adds the new fields empty, so behaviour is unchanged until they are set", () => {
    const out = parseSave(v1);
    expect(out.learnerName).toBe("");
    expect(out.voiceURI).toBe("");
  });

  it("stamps the new version", () => {
    expect(parseSave(v1).v).toBe(SCHEMA_VERSION);
    expect(SCHEMA_VERSION).toBe(2);
  });

  it("is idempotent, so re-reading a migrated save changes nothing", () => {
    const once = parseSave(v1);
    expect(parseSave(JSON.stringify(once))).toEqual(once);
  });
});

describe("rollWeek", () => {
  it("clears the weekly count in a new week but never the lifetime total", () => {
    const save = { ...freshSave(), stars: 80, week: { start: "2020-01-06", stars: 12, days: [0, 1] } };
    const rolled = rollWeek(save, new Date("2026-09-07T08:00:00"));
    expect(rolled.week.stars).toBe(0);
    expect(rolled.week.days).toEqual([]);
    expect(rolled.stars).toBe(80); // the trophy shelf is untouched
  });

  it("leaves the week alone inside the same week", () => {
    const save = { ...freshSave(), week: { start: "2026-09-07", stars: 12, days: [0] } };
    expect(rollWeek(save, new Date("2026-09-09T08:00:00")).week.stars).toBe(12);
  });
});
