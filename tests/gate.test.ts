import { describe, it, expect } from "vitest";
import { makeGateChallenge, cleanPin, isUsablePin, PIN_MIN, PIN_MAX } from "../src/gate.js";
import { parseSave, freshSave, forBackup, SCHEMA_VERSION } from "../src/state.js";

describe("makeGateChallenge", () => {
  it("is always arithmetically correct", () => {
    for (let i = 0; i < 500; i++) {
      const q = makeGateChallenge();
      const [a, op, b] = q.text.split(" ");
      const real = op === "×" ? Number(a) * Number(b) : Number(a) / Number(b);
      expect(q.answer).toBe(real);
    }
  });

  it("divides evenly, so a grown-up never meets a remainder", () => {
    for (let i = 0; i < 500; i++) {
      const q = makeGateChallenge();
      if (!q.text.includes("÷")) continue;
      expect(Number.isInteger(q.answer)).toBe(true);
    }
  });

  // The whole point of the change: a young child can grind out 47 + 25, but
  // not a times table they have not been taught.
  it("never uses a factor a young child would find easy", () => {
    for (let i = 0; i < 500; i++) {
      const parts = makeGateChallenge().text.split(" ");
      const b = Number(parts[2]);
      expect([1, 2, 10]).not.toContain(b);
      if (parts[1] === "×") expect([1, 2, 10]).not.toContain(Number(parts[0]));
    }
  });

  it("asks both kinds over a run", () => {
    const kinds = new Set(Array.from({ length: 200 }, () => (makeGateChallenge().text.includes("×") ? "x" : "d")));
    expect(kinds.size).toBe(2);
  });

  it("is deterministic given a fixed source of randomness", () => {
    const fixed = (): number => 0.1;
    expect(makeGateChallenge(fixed)).toEqual(makeGateChallenge(fixed));
  });
});

describe("cleanPin", () => {
  it("keeps digits and drops everything else", () => {
    expect(cleanPin("12ab34")).toBe("1234");
    expect(cleanPin(" 9 8 7 6 ")).toBe("9876");
  });
  it("treats anything that is not a string as no PIN", () => {
    for (const junk of [null, undefined, 1234, {}]) expect(cleanPin(junk)).toBe("");
  });
  it("caps the length", () => {
    expect(cleanPin("1".repeat(50))).toHaveLength(PIN_MAX);
  });
});

describe("isUsablePin", () => {
  it("needs enough digits to be worth having", () => {
    expect(isUsablePin("123")).toBe(false);
    expect(isUsablePin("1".repeat(PIN_MIN))).toBe(true);
  });
  it("rejects an empty PIN, which means no PIN at all", () => {
    expect(isUsablePin("")).toBe(false);
  });
});

describe("the PIN and backups", () => {
  // A backup gets pasted into an email. A PIN a grown-up also uses elsewhere
  // has no business travelling in one.
  it("is left out of a copied backup", () => {
    const save = { ...freshSave(), gatePin: "4821", stars: 12 };
    const backup = forBackup(save);
    expect(JSON.stringify(backup)).not.toContain("4821");
    expect("gatePin" in backup).toBe(false);
  });

  it("keeps everything else in the backup", () => {
    const save = { ...freshSave(), gatePin: "4821", stars: 12, learnerName: "Robin" };
    const backup = forBackup(save);
    expect(backup.stars).toBe(12);
    expect(backup.learnerName).toBe("Robin");
  });

  it("restores with no PIN, falling back to the times table", () => {
    const save = { ...freshSave(), gatePin: "4821", stars: 12 };
    const restored = parseSave(JSON.stringify(forBackup(save)));
    expect(restored.gatePin).toBe("");
    expect(restored.stars).toBe(12);
  });
});

describe("migrating to v3", () => {
  it("gives a v2 save an empty PIN and keeps the rest", () => {
    const v2 = JSON.stringify({ v: 2, stars: 8, learnerName: "Robin", voiceURI: "x", layout: "abc" });
    const out = parseSave(v2);
    expect(out.gatePin).toBe("");
    expect(out.stars).toBe(8);
    expect(out.learnerName).toBe("Robin");
    expect(out.v).toBe(SCHEMA_VERSION);
    expect(SCHEMA_VERSION).toBe(3);
  });

  it("carries a v1 save all the way through", () => {
    const out = parseSave(JSON.stringify({ v: 1, stars: 40, words: ["cat"] }));
    expect(out.stars).toBe(40);
    expect(out.learnerName).toBe("");
    expect(out.gatePin).toBe("");
    expect(out.v).toBe(3);
  });

  it("throws away a stored PIN that is not digits", () => {
    expect(parseSave(JSON.stringify({ v: 3, gatePin: "hunter2" })).gatePin).toBe("2");
  });
});
