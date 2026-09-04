import { describe, it, expect } from "vitest";
import { chooseVoice, englishVoices, spellingParts, type VoiceLike } from "../src/speech.js";
import { WORD_RATE, SENTENCE_RATE, GAP_MS } from "../src/speech.js";

const v = (name: string, lang: string): VoiceLike => ({ name, lang, voiceURI: `${name}:${lang}` });

const DEVICE: VoiceLike[] = [
  v("Samantha", "en-US"),
  v("Karen", "en-AU"),
  v("Daniel", "en-GB"),
  v("Rishi", "en-IN"),
  v("Amelie", "fr-FR"),
  v("Lee", "en-AU"),
];

describe("englishVoices", () => {
  it("drops anything that is not English", () => {
    expect(englishVoices(DEVICE).map((x) => x.name)).not.toContain("Amelie");
  });
  it("puts Australian voices first, then British, then the rest", () => {
    const langs = englishVoices(DEVICE).map((x) => x.lang);
    expect(langs.slice(0, 2)).toEqual(["en-AU", "en-AU"]);
    expect(langs[2]).toBe("en-GB");
  });
  it("sorts by name inside a language, so the list is stable between renders", () => {
    expect(englishVoices(DEVICE).slice(0, 2).map((x) => x.name)).toEqual(["Karen", "Lee"]);
  });
  it("copes with no voices at all", () => {
    expect(englishVoices([])).toEqual([]);
  });
});

describe("chooseVoice", () => {
  it("honours an explicit choice", () => {
    expect(chooseVoice(DEVICE, "Daniel:en-GB")?.name).toBe("Daniel");
  });

  // A save copied between devices can name a voice that is not installed. That
  // must fall back, never leave the app silent.
  it("falls back when the chosen voice is not on this device", () => {
    expect(chooseVoice(DEVICE, "Fiona:en-SCOTLAND")?.lang).toBe("en-AU");
  });

  it("prefers Australian with no choice made", () => {
    expect(chooseVoice(DEVICE)?.lang).toBe("en-AU");
  });
  it("falls to British when there is no Australian voice", () => {
    expect(chooseVoice(DEVICE.filter((x) => x.lang !== "en-AU"))?.lang).toBe("en-GB");
  });
  it("takes any English before a non-English voice", () => {
    const only = [v("Amelie", "fr-FR"), v("Rishi", "en-IN")];
    expect(chooseVoice(only)?.lang).toBe("en-IN");
  });
  it("takes whatever exists rather than nothing", () => {
    expect(chooseVoice([v("Amelie", "fr-FR")])?.name).toBe("Amelie");
  });
  it("returns null with an empty device", () => {
    expect(chooseVoice([])).toBeNull();
  });
});

describe("spellingParts", () => {
  it("reads the word, then a real silence, then the sentence", () => {
    const parts = spellingParts("because", "I was late because of the rain.");
    expect(parts).toHaveLength(3);
    expect(parts.map((p) => ("gap" in p ? "gap" : p.text))).toEqual([
      "because",
      "gap",
      "I was late because of the rain.",
    ]);
  });

  // The speaker button replays the word on demand, so a trailing repeat every
  // time is dead weight.
  it("does not say the word a second time", () => {
    const spoken = spellingParts("water", "I drank water.")
      .filter((p): p is { text: string; rate: number } => "text" in p)
      .map((p) => p.text);
    expect(spoken).toEqual(["water", "I drank water."]);
    expect(spoken.filter((t) => t === "water")).toHaveLength(1);
  });

  // Two signals separate the word from the example: silence, and a slower rate.
  it("reads the target word slower than the sentence", () => {
    const parts = spellingParts("because", "A sentence.");
    const rates = parts.filter((p): p is { text: string; rate: number } => "rate" in p).map((p) => p.rate);
    expect(rates[0]).toBe(WORD_RATE);
    expect(rates[1]).toBe(SENTENCE_RATE);
    expect(WORD_RATE).toBeLessThan(SENTENCE_RATE);
  });

  it("uses a real pause, not a comma-length one", () => {
    const gaps = spellingParts("a", "b").filter((p): p is { gap: number } => "gap" in p);
    expect(gaps).toHaveLength(1);
    expect(gaps[0]!.gap).toBeGreaterThanOrEqual(1000);
    expect(GAP_MS).toBe(2000);
  });

  it("says the word alone when there is no sentence", () => {
    expect(spellingParts("because", "")).toEqual([{ text: "because", rate: WORD_RATE }]);
  });
});
