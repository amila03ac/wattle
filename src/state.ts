/**
 * The saved record. This outlives redesigns, so every change goes through a
 * numbered migration rather than a hopeful `??` at the point of use.
 */
export const SCHEMA_VERSION = 2;
export const STORE_KEY = "wattle.save";

export type MathOp = "add" | "sub" | "mixed";
export type PadLayout = "qwerty" | "abc";

export interface MathRules {
  op: MathOp;
  /** Largest number that may appear in a question or its answer. */
  max: number;
  /** Allow carrying in addition and borrowing in subtraction. */
  regroup: boolean;
}

export interface WeekRecord {
  /** ISO date of the Monday this week began. */
  start: string;
  stars: number;
  /** Weekdays practised, 0 = Monday. Counted, never chained into a streak. */
  days: number[];
}

export interface SaveData {
  v: number;
  /**
   * What to call the learner on the home screen. Stays on this device: it is
   * never sent anywhere, and it is deliberately not in the repo.
   */
  learnerName: string;
  /**
   * Chosen speech voice, by voiceURI. Empty means pick automatically. A device
   * that lacks the saved voice falls back rather than going silent.
   */
  voiceURI: string;
  /** Raw lines, each "word" or "word | a sentence using the word". */
  words: string[];
  /** Words missed and not yet re-learnt; they jump the queue next session. */
  missed: string[];
  math: MathRules;
  layout: PadLayout;
  /** Lifetime total. Only ever goes up. */
  stars: number;
  week: WeekRecord;
}

/** Generic Year 2 examples. Keep real word lists out of version control; see README. */
export const SEED_WORDS: string[] = [
  "because | I was late because of the rain.",
  "friend | My best friend came to play.",
  "people | Lots of people were at the beach.",
  "water | Can I have a glass of water?",
  "school | We walk to school every morning.",
  "night | The owl comes out at night.",
  "birthday | I blew out the candles on my birthday.",
  "jumped | The dog jumped over the fence.",
  "mother | My mother made pancakes.",
  "another | Can I have another biscuit?",
];

export function mondayOf(d: Date = new Date()): string {
  const c = new Date(d);
  const offset = (c.getDay() + 6) % 7; // 0 = Monday
  c.setHours(0, 0, 0, 0);
  c.setDate(c.getDate() - offset);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${c.getFullYear()}-${pad(c.getMonth() + 1)}-${pad(c.getDate())}`;
}

export function weekdayIndex(d: Date = new Date()): number {
  return (d.getDay() + 6) % 7;
}

export function freshSave(): SaveData {
  return {
    v: SCHEMA_VERSION,
    learnerName: "",
    voiceURI: "",
    words: [...SEED_WORDS],
    missed: [],
    math: { op: "mixed", max: 100, regroup: true },
    layout: "qwerty",
    stars: 0,
    week: { start: mondayOf(), stars: 0, days: [] },
  };
}

/**
 * Bring any older save up to the current schema. Add a case per version bump;
 * never reshape data in place elsewhere.
 */
function migrate(raw: Record<string, unknown>): Record<string, unknown> {
  const data = { ...raw };
  const from = typeof data["v"] === "number" ? (data["v"] as number) : 1;

  // v1 -> v2: a name for the home screen, and a chosen voice. Both optional,
  // so an existing save gains them empty and behaves exactly as before.
  if (from < 2) {
    if (typeof data["learnerName"] !== "string") data["learnerName"] = "";
    if (typeof data["voiceURI"] !== "string") data["voiceURI"] = "";
    data["v"] = 2;
  }

  return data;
}

/** Long enough for any name, short enough to sit on one line of the greeting. */
export const MAX_NAME_LEN = 24;

export function cleanName(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return raw.replace(/\s+/g, " ").trim().slice(0, MAX_NAME_LEN);
}

/** Defensive: a save may be truncated, hand-edited, or from a future version. */
export function parseSave(text: string | null): SaveData {
  if (!text) return freshSave();
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return freshSave();
  }
  if (typeof raw !== "object" || raw === null) return freshSave();

  const d = migrate(raw as Record<string, unknown>);
  const base = freshSave();
  const words = Array.isArray(d["words"]) ? (d["words"] as unknown[]).filter(isNonEmptyString) : base.words;
  const missed = Array.isArray(d["missed"]) ? (d["missed"] as unknown[]).filter(isNonEmptyString) : [];
  const math = d["math"] as Partial<MathRules> | undefined;
  const week = d["week"] as Partial<WeekRecord> | undefined;

  const save: SaveData = {
    v: SCHEMA_VERSION,
    learnerName: cleanName(d["learnerName"]),
    voiceURI: typeof d["voiceURI"] === "string" ? d["voiceURI"].slice(0, 300) : "",
    words: words.length ? words : base.words,
    missed,
    math: {
      op: math?.op === "add" || math?.op === "sub" || math?.op === "mixed" ? math.op : base.math.op,
      max: typeof math?.max === "number" && math.max >= 5 ? Math.min(math.max, 1000) : base.math.max,
      regroup: typeof math?.regroup === "boolean" ? math.regroup : base.math.regroup,
    },
    layout: d["layout"] === "abc" ? "abc" : "qwerty",
    stars: typeof d["stars"] === "number" && d["stars"] >= 0 ? d["stars"] : 0,
    week: {
      start: typeof week?.start === "string" ? week.start : mondayOf(),
      stars: typeof week?.stars === "number" && week.stars >= 0 ? week.stars : 0,
      days: Array.isArray(week?.days) ? week.days.filter((n): n is number => typeof n === "number" && n >= 0 && n < 7) : [],
    },
  };
  return rollWeek(save);
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

/** A new week clears the weekly counter. The lifetime total is never touched. */
export function rollWeek(save: SaveData, now: Date = new Date()): SaveData {
  const monday = mondayOf(now);
  if (save.week.start === monday) return save;
  return { ...save, week: { start: monday, stars: 0, days: [] } };
}
