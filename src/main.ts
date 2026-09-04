import "./styles.css";
import { createStore, requestPersistence, type Store } from "./storage.js";
import {
  STORE_KEY,
  parseSave,
  freshSave,
  rollWeek,
  type SaveData,
  type MathOp,
  type PadLayout,
} from "./state.js";
import {
  parseWord,
  clozeSegments,
  pickSpellingSession,
  makeSums,
  isCorrectSpelling,
  isCorrectSum,
  type Sum,
  type SpellingItem,
} from "./content.js";
import { starsFor, bankSession, progress, formatStars, MILESTONES } from "./scoring.js";
import { Speech, spellingParts, WORD_RATE } from "./speech.js";
import { letterRows, widestRow, readKey, MAX_SPELLING_LEN, MAX_ANSWER_LEN } from "./keypad.js";
import { el, need, clear, setText } from "./dom.js";

/* A failure must be visible: this runs on a tablet nobody can attach a debugger to. */
window.addEventListener("error", (e) => {
  let bar = document.querySelector<HTMLDivElement>(".errbar");
  if (!bar) {
    bar = el("div", { class: "errbar" });
    document.body.append(bar);
  }
  setText(bar, `Something broke: ${e.message} (line ${e.lineno})`);
});

const store: Store = createStore();
const speech = new Speech();
let save: SaveData = freshSave();

const persist = async (): Promise<void> => {
  try {
    await store.set(STORE_KEY, JSON.stringify(save));
  } catch {
    /* a full disk should not end the session */
  }
};

/* ------------------------------------------------------------------ screens */

type ScreenId = "home" | "gate" | "setup" | "drill" | "done";

function show(id: ScreenId): void {
  for (const s of document.querySelectorAll<HTMLElement>(".screen")) {
    s.classList.toggle("on", s.id === `s-${id}`);
  }
  window.scrollTo(0, 0);
}

/* --------------------------------------------------------------------- home */

function paintHome(): void {
  setText(need("#total"), formatStars(save.stars));
  setText(need("#week"), `${formatStars(save.week.stars)} this week`);
  setText(need("#wordCount"), `${save.words.length} ${save.words.length === 1 ? "word" : "words"} ready`);

  const opWord =
    save.math.op === "add" ? "Adding" : save.math.op === "sub" ? "Taking away" : "Adding and taking away";
  setText(need("#mathDesc"), `${opWord}, up to ${save.math.max}`);

  const p = progress(save.stars);
  setText(need("#nextName"), p.next ? `Next: ${p.next.label}` : "Every badge earned!");
  setText(need("#nextLeft"), p.next ? `${formatStars(p.toGo)} to go` : "");
  need<HTMLElement>("#fill").style.width = `${p.fraction * 100}%`;

  const badges = need("#badges");
  clear(badges);
  for (const m of MILESTONES) {
    const won = save.stars >= m.at;
    badges.append(el("span", { class: won ? "badge" : "badge locked" }, [won ? `★ ${m.label}` : m.label]));
  }

  const days = need("#days");
  clear(days);
  ["M", "T", "W", "T", "F", "S", "S"].forEach((letter, i) => {
    days.append(el("div", { class: save.week.days.includes(i) ? "day done" : "day" }, [letter]));
  });
}

/* -------------------------------------------------------------------- drill */

type Mode = "spell" | "math";
interface Session {
  mode: Mode;
  items: (string | Sum)[];
  index: number;
  attempt: number;
  earned: number;
  typed: string;
  locked: boolean;
}
let session: Session | null = null;

function startSession(mode: Mode): void {
  let items: (string | Sum)[];
  if (mode === "spell") {
    if (!save.words.length) {
      window.alert("Add some spelling words first. Tap Grown-ups.");
      return;
    }
    items = pickSpellingSession(save.words, save.missed);
  } else {
    items = makeSums(save.math);
  }
  session = { mode, items, index: 0, attempt: 0, earned: 0, typed: "", locked: false };
  show("drill");
  paintPad();
  paintStage();
}

function currentSpelling(s: Session): SpellingItem {
  return parseWord(s.items[s.index] as string);
}

function paintDots(s: Session): void {
  const dots = need("#dots");
  clear(dots);
  s.items.forEach((_, i) => {
    const cls = i < s.index ? "dot done" : i === s.index ? "dot now" : "dot";
    dots.append(el("span", { class: cls }));
  });
  setText(need("#earned"), `★ ${formatStars(s.earned)}`);
}

function clueNode(item: SpellingItem, aside: boolean): HTMLElement | null {
  const segs = clozeSegments(item);
  if (!segs.length) return null;
  const p = el("p", { class: aside ? "clue aside" : "clue" });
  for (const seg of segs) p.append(seg.blank ? el("b", {}, [seg.text]) : document.createTextNode(seg.text));
  return p;
}

function paintStage(): void {
  const s = session;
  if (!s) return;
  paintDots(s);
  const stage = need("#stage");
  clear(stage);

  if (s.mode === "spell") {
    const item = currentSpelling(s);
    const heard = speech.available();

    if (heard) {
      const btn = el("button", { class: "speak", id: "speakBtn", "aria-label": "Hear the word again" }, ["🔊"]);
      btn.addEventListener("click", () => speech.say([{ text: item.word, rate: WORD_RATE }]));
      stage.append(btn, el("p", { class: "hint" }, ["Tap the speaker to hear the word again."]));
      const aside = clueNode(item, true);
      if (aside) {
        const again = el("button", { class: "again" }, ["Read it all again"]);
        again.addEventListener("click", () => speech.say(spellingParts(item.word, item.sentence)));
        aside.append(el("br"), again);
        stage.append(aside);
      }
      setTimeout(() => speech.say(spellingParts(item.word, item.sentence)), 300);
    } else {
      // No voice: the sentence with a gap is the clue. Never show the word,
      // because that would turn a spelling test into a copying exercise.
      const clue = clueNode(item, false);
      if (clue) {
        stage.append(clue, el("p", { class: "hint" }, ["Which word fills the gap?"]));
      } else {
        stage.append(
          el("p", { class: "clue" }, ["This word has no clue yet."]),
          el("p", { class: "hint" }, ["Ask a grown-up to add a sentence for it, or turn the voice on."]),
        );
      }
    }
  } else {
    const sum = s.items[s.index] as Sum;
    stage.append(el("div", { class: "sum" }, [`${sum.a} ${sum.op} ${sum.b}`]));
  }

  stage.append(el("div", { class: "slot", id: "slot" }), el("p", { class: "say", id: "say" }));
  s.typed = "";
  s.locked = false;
  paintSlot();
}

function paintSlot(): void {
  const s = session;
  if (!s) return;
  const slot = need("#slot");
  slot.className = s.mode === "math" ? "slot num" : "slot";
  clear(slot);
  if (s.typed) setText(slot, s.typed);
  else slot.append(el("span", { class: "caret" }, ["–"]));
}

function paintPad(): void {
  const s = session;
  if (!s) return;
  const pad = need<HTMLElement>("#pad");
  clear(pad);
  pad.classList.toggle("numpad", s.mode === "math");

  const rows = s.mode === "spell" ? letterRows(save.layout) : ["789", "456", "123"];
  pad.style.setProperty("--keys", String(s.mode === "spell" ? widestRow(rows) : 3));

  for (const row of rows) {
    const r = el("div", { class: "row" });
    for (const ch of row) r.append(el("button", { class: "key", "data-k": ch }, [ch]));
    pad.append(r);
  }

  const actions = el("div", { class: "row actions" });
  if (s.mode === "spell") {
    actions.append(
      el("button", { class: "key", "data-k": "del" }, ["⌫ Rub out"]),
      el("button", { class: "key go", "data-k": "go" }, ["Done ✓"]),
    );
  } else {
    actions.append(
      el("button", { class: "key", "data-k": "del" }, ["⌫"]),
      el("button", { class: "key", "data-k": "0" }, ["0"]),
      el("button", { class: "key go", "data-k": "go" }, ["Done ✓"]),
    );
  }
  pad.append(actions);
}

need("#pad").addEventListener("click", (e) => {
  const s = session;
  if (!s || s.locked) return;
  const btn = (e.target as HTMLElement).closest<HTMLElement>("[data-k]");
  if (!btn) return;
  const press = readKey(btn.dataset["k"] ?? "");
  if (press.kind === "submit") return void submitAnswer();
  if (press.kind === "delete") s.typed = s.typed.slice(0, -1);
  else if (s.typed.length < (s.mode === "spell" ? MAX_SPELLING_LEN : MAX_ANSWER_LEN)) s.typed += press.value;
  paintSlot();
});

function submitAnswer(): void {
  const s = session;
  if (!s || !s.typed) return;
  const item = s.items[s.index]!;
  const correct =
    s.mode === "spell" ? isCorrectSpelling(s.typed, parseWord(item as string)) : isCorrectSum(s.typed, item as Sum);

  const slot = need("#slot");
  const msg = need("#say");

  if (correct) {
    const won = starsFor(s.attempt, true);
    s.earned += won;
    s.locked = true;
    slot.classList.add("good");
    msg.className = "say good";
    setText(msg, s.attempt === 0 ? "Yes! ★ 1 star" : "Got there: ★ ½ a star");
    if (s.mode === "spell") save.missed = save.missed.filter((w) => w !== item);
    setTimeout(nextItem, 1150);
    return;
  }

  if (s.attempt === 0) {
    s.attempt = 1;
    s.typed = "";
    slot.classList.add("bad");
    msg.className = "say bad";
    setText(msg, "Not quite. Have another go.");
    setTimeout(() => {
      paintSlot();
      if (s.mode === "spell") {
        const w = parseWord(item as string);
        speech.say([{ text: w.word, rate: WORD_RATE }]);
      }
    }, 700);
    return;
  }

  s.locked = true;
  msg.className = "say";
  clear(msg);
  if (s.mode === "spell") {
    const w = parseWord(item as string);
    msg.append("It is spelt ", el("span", { class: "reveal" }, [w.word]));
    if (!save.missed.includes(item as string)) save.missed.push(item as string);
    speech.say([{ text: w.word, rate: WORD_RATE }]);
  } else {
    msg.append("The answer is ", el("span", { class: "reveal" }, [String((item as Sum).answer)]));
  }
  setTimeout(nextItem, 2600);
}

function nextItem(): void {
  const s = session;
  if (!s) return;
  s.attempt = 0;
  s.index++;
  if (s.index < s.items.length) {
    paintStage();
    return;
  }
  save = bankSession(save, s.earned);
  void persist();
  paintHome();
  setText(need("#doneTitle"), s.earned >= 9 ? "Brilliant!" : s.earned >= 6 ? "Well done!" : "Good practice!");
  setText(
    need("#doneMsg"),
    `You earned ${formatStars(s.earned)} stars. That makes ${formatStars(save.stars)} altogether.`,
  );
  session = null;
  show("done");
}

/* -------------------------------------------------------------------- setup */

function paintSetup(): void {
  need<HTMLTextAreaElement>("#wordsInput").value = save.words.join("\n");
  const live = save.missed.filter((w) => save.words.includes(w));
  setText(
    need("#missNote"),
    live.length
      ? `Coming back next time: ${live.map((l) => parseWord(l).word).join(", ")}`
      : "Missed words come back automatically next time.",
  );

  const press = (id: string, attr: string, value: string): void => {
    for (const b of document.querySelectorAll<HTMLElement>(`#${id} button`)) {
      b.setAttribute("aria-pressed", String(b.dataset[attr] === value));
    }
  };
  press("opSeg", "op", save.math.op);
  press("maxSeg", "max", String(save.math.max));
  press("regSeg", "reg", save.math.regroup ? "1" : "0");
  press("layoutSeg", "layout", save.layout);

  setText(
    need("#voiceNote"),
    speech.available()
      ? `Voice in use: ${speech.voiceLabel()}`
      : "This device has no speech, so the sentence with a gap is used as the clue instead.",
  );
  setText(
    need("#storeNote"),
    store.kind === "native"
      ? "Saved to app storage. Survives clearing browser data."
      : store.kind === "web"
        ? "Saved in this browser. Clearing browsing data erases it, so keep a backup."
        : "Nothing can be saved on this device; stars will not survive a reload.",
  );
}

need<HTMLTextAreaElement>("#wordsInput").addEventListener("input", (e) => {
  save.words = (e.target as HTMLTextAreaElement).value
    .split("\n")
    .map((w) => w.trim())
    .filter(Boolean);
  void persist();
  paintHome();
});

function wireSegment(id: string, attr: string, apply: (v: string) => void): void {
  need(`#${id}`).addEventListener("click", (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>("button");
    const v = b?.dataset[attr];
    if (v === undefined) return;
    apply(v);
    void persist();
    paintSetup();
    paintHome();
  });
}
wireSegment("opSeg", "op", (v) => (save.math.op = v as MathOp));
wireSegment("maxSeg", "max", (v) => (save.math.max = Number(v)));
wireSegment("regSeg", "reg", (v) => (save.math.regroup = v === "1"));
wireSegment("layoutSeg", "layout", (v) => (save.layout = v as PadLayout));

/* ------------------------------------------------------------------- backup */

need("#exportBtn").addEventListener("click", async () => {
  const text = JSON.stringify(save);
  try {
    await navigator.clipboard.writeText(text);
    setText(need("#backupNote"), "Backup copied. Paste it somewhere safe; an email to yourself works.");
  } catch {
    window.prompt("Copy this and keep it safe:", text);
  }
});

need("#importBtn").addEventListener("click", () => {
  const text = window.prompt("Paste a backup here. This replaces what is on this device.");
  if (!text) return;
  const restored = parseSave(text);
  if (restored.stars === 0 && restored.words.length === 0) {
    setText(need("#backupNote"), "That did not look like a backup. Nothing was changed.");
    return;
  }
  save = restored;
  void persist();
  paintSetup();
  paintHome();
  setText(need("#backupNote"), `Restored: ${formatStars(save.stars)} stars.`);
});

/* --------------------------------------------------------------------- gate */

let gateAnswer = 0;
need("#parentBtn").addEventListener("click", () => {
  const a = 21 + Math.floor(Math.random() * 45);
  const b = 17 + Math.floor(Math.random() * 40);
  gateAnswer = a + b;
  setText(need("#gateSum"), `${a} + ${b}`);
  const input = need<HTMLInputElement>("#gateInput");
  input.value = "";
  show("gate");
  setTimeout(() => input.focus(), 120);
});

need("#gateGo").addEventListener("click", () => {
  const input = need<HTMLInputElement>("#gateInput");
  if (Number(input.value) === gateAnswer) {
    paintSetup();
    show("setup");
  } else {
    input.value = "";
    input.placeholder = "Try again";
  }
});
need("#gateInput").addEventListener("keydown", (e) => {
  if ((e as KeyboardEvent).key === "Enter") need<HTMLElement>("#gateGo").click();
});

need("#voiceTest").addEventListener("click", () => {
  const out = need("#voiceResult");
  if (!speech.available()) {
    setText(out, "No speech on this device at all.");
    return;
  }
  setText(out, `Speaking now… (${speech.voiceCount()} voices, ${speech.voiceLabel()})`);
  speech.say([{ text: "Hello. Can you hear me?", rate: 0.85 }], () =>
    setText(out, `It works. ${speech.voiceLabel()}, ${speech.voiceCount()} voices.`),
  );
});

/* --------------------------------------------------------------- navigation */

for (const b of document.querySelectorAll<HTMLElement>("[data-go]")) {
  b.addEventListener("click", () => startSession(b.dataset["go"] as Mode));
}
for (const b of document.querySelectorAll<HTMLElement>("[data-back]")) {
  b.addEventListener("click", () => {
    speech.stop();
    session = null;
    paintHome();
    show("home");
  });
}

/* --------------------------------------------------------------------- boot */

async function boot(): Promise<void> {
  save = rollWeek(parseSave(await store.get(STORE_KEY)));
  await persist();
  void requestPersistence();
  paintHome();
}
void boot();
