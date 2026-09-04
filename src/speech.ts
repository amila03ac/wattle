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

export class Speech {
  private synth: SpeechSynthesis | null;
  private voice: SpeechSynthesisVoice | null = null;
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
      // Android populates the voice list asynchronously.
      this.synth.onvoiceschanged = () => this.refreshVoice();
    }
  }

  available(): boolean {
    return this.synth !== null;
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
    for (const prefix of AU_FIRST) {
      const hit = voices.find((v) => v.lang?.startsWith(prefix));
      if (hit) {
        this.voice = hit;
        return;
      }
    }
    this.voice = voices[0] ?? null;
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
  say(parts: SpeechPart[], onDone?: () => void): void {
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
        if (this.voice) {
          u.voice = this.voice;
          u.lang = this.voice.lang;
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
