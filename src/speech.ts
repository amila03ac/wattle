/**
 * Reading the word aloud.
 *
 * This is the app's one hard platform dependency, and it is not always there:
 * some embedded WebViews expose no `speechSynthesis` at all. Every call is
 * guarded and `available()` is honest about it, so the UI can fall back to the
 * cloze clue rather than showing the learner the word they are meant to spell.
 */

export type SpeechPart = { text: string; rate: number } | { gap: number };

const AU_FIRST = ["en-AU", "en-GB", "en"];

/** Fired when the device finishes populating its voice list. */
export const VOICES_READY = "wattle:voices";

/** The shape we need from a voice. Kept minimal so the logic is testable. */
export interface VoiceLike {
  voiceURI: string;
  name: string;
  lang: string;
}

/**
 * Which voice to speak with.
 *
 * A chosen voice wins whenever the device still has it. Voice lists differ
 * wildly between devices, so a save copied from one tablet to another may name
 * a voice that is not installed; that falls through to the automatic order
 * rather than leaving the app silent.
 */
export function chooseVoice<T extends VoiceLike>(voices: readonly T[], preferredURI = ""): T | null {
  if (!voices.length) return null;
  if (preferredURI) {
    const exact = voices.find((v) => v.voiceURI === preferredURI);
    if (exact) return exact;
  }
  for (const prefix of AU_FIRST) {
    const hit = voices.find((v) => v.lang?.startsWith(prefix));
    if (hit) return hit;
  }
  return voices[0] ?? null;
}

/** English voices only, Australian first, so the list is short and relevant. */
export function englishVoices<T extends VoiceLike>(voices: readonly T[]): T[] {
  const rank = (v: T): number => {
    const i = AU_FIRST.findIndex((p) => v.lang?.startsWith(p));
    return i === -1 ? AU_FIRST.length : i;
  };
  return voices
    .filter((v) => (v.lang ?? "").toLowerCase().startsWith("en"))
    .sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));
}

/** Spoken when trying a voice out, so the sample matches the real task. */
export const VOICE_SAMPLE = "because. I was late because of the rain.";

export class Speech {
  private synth: SpeechSynthesis | null;
  private voice: SpeechSynthesisVoice | null = null;
  private preferredURI = "";
  /** Invalidates a chain still in flight when the user taps again or leaves. */
  private generation = 0;

  constructor() {
    let s: SpeechSynthesis | null = null;
    try {
      s = globalThis.speechSynthesis ?? null;
    } catch {
      s = null;
    }
    this.synth = s;
    this.refreshVoice();
    if (this.synth) {
      // Android populates the voice list asynchronously, so anything showing
      // the list needs telling once it actually arrives.
      this.synth.onvoiceschanged = () => {
        this.refreshVoice();
        try {
          window.dispatchEvent(new Event(VOICES_READY));
        } catch {
          /* no window in a test environment */
        }
      };
    }
  }

  available(): boolean {
    return this.synth !== null;
  }

  /** Every English voice this device offers, Australian ones first. */
  list(): SpeechSynthesisVoice[] {
    if (!this.synth) return [];
    try {
      return englishVoices(this.synth.getVoices());
    } catch {
      return [];
    }
  }

  /** Remember a choice. Empty string goes back to picking automatically. */
  prefer(voiceURI: string): void {
    this.preferredURI = voiceURI;
    this.refreshVoice();
  }

  currentURI(): string {
    return this.voice?.voiceURI ?? "";
  }

  /** True when a chosen voice is named but missing from this device. */
  preferenceMissing(): boolean {
    if (!this.preferredURI) return false;
    return !this.list().some((v) => v.voiceURI === this.preferredURI);
  }

  voiceLabel(): string {
    if (!this.synth) return "no speech on this device";
    if (!this.voice) return "no voice chosen yet";
    return `${this.voice.name} (${this.voice.lang})`;
  }

  voiceCount(): number {
    try {
      return this.synth?.getVoices().length ?? 0;
    } catch {
      return 0;
    }
  }

  private refreshVoice(): void {
    if (!this.synth) return;
    let voices: SpeechSynthesisVoice[] = [];
    try {
      voices = this.synth.getVoices();
    } catch {
      return;
    }
    if (!voices.length) return;
    this.voice = chooseVoice(voices, this.preferredURI);
  }

  stop(): void {
    this.generation++;
    try {
      this.synth?.cancel();
    } catch {
      /* ignore */
    }
  }

  /**
   * Utterances queued back-to-back run together with no real pause, so the
   * parts are chained by hand with genuine silence between them. Without this
   * the word and the example sentence blur into one stream and a child cannot
   * tell which one is the word being asked for.
   */
  /** Speak a sample in one specific voice, without changing the saved choice. */
  preview(voiceURI: string, onDone?: () => void): void {
    const voice = this.list().find((v) => v.voiceURI === voiceURI) ?? null;
    this.say([{ text: VOICE_SAMPLE, rate: SENTENCE_RATE }], onDone, voice);
  }

  say(parts: SpeechPart[], onDone?: () => void, useVoice?: SpeechSynthesisVoice | null): void {
    if (!this.synth) {
      onDone?.();
      return;
    }
    this.stop();
    const mine = this.generation;
    let i = 0;

    const step = (): void => {
      if (mine !== this.generation) return; // superseded
      const part = parts[i++];
      if (!part) {
        onDone?.();
        return;
      }
      if ("gap" in part) {
        setTimeout(step, part.gap);
        return;
      }
      try {
        const u = new SpeechSynthesisUtterance(part.text);
        const voice = useVoice ?? this.voice;
        if (voice) {
          u.voice = voice;
          u.lang = voice.lang;
        } else {
          u.lang = "en-AU";
        }
        u.rate = part.rate;
        u.onend = step;
        u.onerror = step;
        this.synth!.speak(u);
      } catch {
        step();
      }
    };
    step();
  }
}

/* Reading pace. Tune these if the parts still run together for a young listener. */
export const WORD_RATE = 0.5; // the word to be spelled: slow and deliberate
export const SENTENCE_RATE = 0.92; // the example: brisker, so it sounds like a separate thing
export const GAP_MS = 2000; // real silence either side of the sentence

/** Word, beat, sentence, beat, word: the way a teacher reads a spelling test. */
export function spellingParts(word: string, sentence: string): SpeechPart[] {
  if (!sentence) return [{ text: word, rate: WORD_RATE }];
  return [
    { text: word, rate: WORD_RATE },
    { gap: GAP_MS },
    { text: sentence, rate: SENTENCE_RATE },
    { gap: GAP_MS },
    { text: word, rate: WORD_RATE },
  ];
}
