import type { SaveData } from "./state.js";
import { weekdayIndex } from "./state.js";

/**
 * A full star first go, half a star on the second, nothing after that. Note
 * what is deliberately absent: there is no reward for a failed attempt.
 * Rewarding failure creates an obvious exploit, and young players find it.
 */
export const FULL_STAR = 1;
export const HALF_STAR = 0.5;

export function starsFor(attempt: number, correct: boolean): number {
  if (!correct) return 0;
  return attempt === 0 ? FULL_STAR : HALF_STAR;
}

export interface Milestone {
  at: number;
  label: string;
}

export const MILESTONES: Milestone[] = [
  { at: 20, label: "20 stars" },
  { at: 50, label: "50 stars" },
  { at: 100, label: "100 stars" },
  { at: 250, label: "250 stars" },
];

export interface Progress {
  next: Milestone | null;
  toGo: number;
  /** 0–1 through the current band, for the bar. */
  fraction: number;
}

export function progress(stars: number): Progress {
  const next = MILESTONES.find((m) => m.at > stars) ?? null;
  if (!next) return { next: null, toGo: 0, fraction: 1 };
  const prev = [...MILESTONES].reverse().find((m) => m.at <= stars);
  const base = prev ? prev.at : 0;
  return {
    next,
    toGo: next.at - stars,
    fraction: Math.min(1, Math.max(0, (stars - base) / (next.at - base))),
  };
}

/**
 * Bank a finished session. The lifetime total only ever grows; the weekly
 * counter is separate so it can reset on Monday without deleting anything
 * already earned. Days are counted, never chained. Missing a day costs nothing,
 * because a broken streak punishes illness and holidays as if they were
 * laziness.
 */
export function bankSession(save: SaveData, earned: number, now: Date = new Date()): SaveData {
  const day = weekdayIndex(now);
  const days = earned > 0 && !save.week.days.includes(day) ? [...save.week.days, day] : save.week.days;
  return {
    ...save,
    stars: save.stars + earned,
    week: { ...save.week, stars: save.week.stars + earned, days },
  };
}

/** "0", "3", "3½": halves show as a glyph rather than a decimal point. */
export function formatStars(n: number): string {
  const whole = Math.floor(n);
  const half = n % 1 !== 0;
  if (whole === 0) return half ? "½" : "0";
  return `${whole}${half ? "½" : ""}`;
}
