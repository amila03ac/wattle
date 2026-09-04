import { describe, it, expect } from "vitest";
import { starsFor, bankSession, progress, formatStars } from "../src/scoring.js";
import { freshSave, mondayOf } from "../src/state.js";

describe("starsFor", () => {
  it("gives a full star first go", () => expect(starsFor(0, true)).toBe(1));
  it("gives half a star on the second go", () => expect(starsFor(1, true)).toBe(0.5));

  // The rule that matters: a wrong answer earns nothing. Rewarding a failed
  // attempt creates an obvious exploit: answer badly on purpose, collect anyway.
  it("gives nothing for a wrong answer, on either attempt", () => {
    expect(starsFor(0, false)).toBe(0);
    expect(starsFor(1, false)).toBe(0);
  });
});

describe("formatStars", () => {
  it.each([
    [0, "0"],
    [0.5, "½"],
    [1, "1"],
    [3.5, "3½"],
    [12, "12"],
  ])("shows %s as %s", (n, out) => expect(formatStars(n)).toBe(out));
});

describe("progress", () => {
  it("points at the next milestone", () => {
    const p = progress(0);
    expect(p.next?.at).toBe(20);
    expect(p.toGo).toBe(20);
  });
  it("measures from the previous milestone, not from zero", () => {
    expect(progress(35).fraction).toBeCloseTo((35 - 20) / (50 - 20));
  });
  it("copes with every badge earned", () => {
    const p = progress(9999);
    expect(p.next).toBeNull();
    expect(p.fraction).toBe(1);
  });
});

describe("bankSession", () => {
  const monday = new Date("2026-09-07T09:00:00");

  it("adds to both the lifetime and the weekly count", () => {
    const after = bankSession(freshSave(), 7.5, monday);
    expect(after.stars).toBe(7.5);
    expect(after.week.stars).toBe(7.5);
  });

  it("counts the day practised", () => {
    expect(bankSession(freshSave(), 3, monday).week.days).toEqual([0]);
  });

  it("counts a day once however many sessions are played", () => {
    const one = bankSession(freshSave(), 3, monday);
    expect(bankSession(one, 3, monday).week.days).toEqual([0]);
  });

  it("does not count a day that earned nothing", () => {
    expect(bankSession(freshSave(), 0, monday).week.days).toEqual([]);
  });

  it("never reduces the lifetime total", () => {
    const start = freshSave();
    const after = bankSession(start, 0, monday);
    expect(after.stars).toBeGreaterThanOrEqual(start.stars);
  });

  it("leaves the original untouched", () => {
    const start = freshSave();
    bankSession(start, 5, monday);
    expect(start.stars).toBe(0);
  });
});

describe("weeks", () => {
  it("starts on a Monday whatever day it is", () => {
    expect(mondayOf(new Date("2026-09-06T23:00:00"))).toBe("2026-08-31"); // a Sunday
    expect(mondayOf(new Date("2026-09-07T00:30:00"))).toBe("2026-09-07"); // the Monday
  });
});
