/**
 * Keeping a child out of the settings.
 *
 * This is not security. It is a speed bump sized to one person: it has to be
 * beyond a young child and trivial for an adult. Times tables fit exactly. An
 * addition question does not, because a determined seven-year-old will work
 * 47 + 25 out given a minute.
 */

export interface GateChallenge {
  /** Shown on screen, using proper × and ÷ signs rather than * and /. */
  text: string;
  answer: number;
}

/**
 * 10 is left out because anything times ten is a giveaway, and 1 and 2 for the
 * same reason. What remains needs a times table a child has not met yet.
 */
const FACTORS = [6, 7, 8, 9, 11, 12] as const;

export function makeGateChallenge(rand: () => number = Math.random): GateChallenge {
  const pick = (): number => FACTORS[Math.floor(rand() * FACTORS.length)] ?? 7;
  const a = pick();
  const b = pick();
  // Division questions are built backwards from a product, so they always come
  // out whole. Nobody should meet a remainder on the way to the settings.
  return rand() < 0.5
    ? { text: `${a} × ${b}`, answer: a * b }
    : { text: `${a * b} ÷ ${b}`, answer: a };
}

export const PIN_MIN = 4;
export const PIN_MAX = 8;

/** Digits only. Anything else is not a PIN, it is a typo. */
export function cleanPin(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return raw.replace(/\D/g, "").slice(0, PIN_MAX);
}

export function isUsablePin(pin: string): boolean {
  return pin.length >= PIN_MIN && pin.length <= PIN_MAX && /^\d+$/.test(pin);
}
