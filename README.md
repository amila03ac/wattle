# Wattle

Spelling and maths practice for primary-school children. A grown-up sets the
work, the device reads each word aloud, and the learner earns stars.

- **Works offline.** Install it once and it never needs the network again.
- **Keeps nothing off the device.** No analytics, no tracking, no telemetry, and
  no third-party requests at all: even the fonts ship with the app.
- **The grown-up writes the content.** This week's real spelling list, not a
  stock word bank chosen by someone else.

## Install it

**<https://amila03ac.github.io/wattle/>**

Open that on a phone or tablet, then choose **Add to Home Screen**. You get an
icon that opens fullscreen with no browser bars, and after that first visit it
runs with the network off. Updates arrive quietly the next time it is opened
online.

---

## The two drills

**Spelling.** The word is spoken, never shown. The learner hears it, then taps
it out on a large on-screen letter pad; a full keyboard would test typing rather
than spelling. Each word can carry a sentence, read after the word the way a
teacher reads a spelling test.

**Maths.** Addition and subtraction, generated from rules rather than typed out.
Set the operation, the ceiling, and whether to include carrying and borrowing;
ten fresh questions appear each time. Answers are never negative and never
trivial, and there is no timer. Two-digit sums often need working out on paper,
and timing that teaches guessing instead of arithmetic.

## Stars

| outcome | stars |
| --- | --- |
| right first go | ★ 1 |
| right on the second go | ★ ½ |
| missed both goes | none, and the word returns next session |

A wrong answer earns nothing. Rewarding a failed attempt creates an obvious
exploit: answer badly on purpose, collect anyway.

Two counters run side by side. The **lifetime total** only ever goes up, with
badges at 20, 50, 100 and 250. The **weekly count** resets each Monday, so there
is something to chase without deleting anything already earned. Days practised
are counted, never chained into a streak. Missing a day costs nothing, because a
broken streak punishes illness and holidays as if they were laziness.

## Setting the work

Behind a grown-ups gate: a two-digit sum rather than a PIN that can be watched
and copied.

```
because | I was late because of the rain.
friend  | My best friend came to play.
water
```

One word per line. The part after `|` is optional. It is read aloud after the
word, and if the device has no speech it becomes the clue, shown with the word
blanked out. The word itself is never displayed, since that would turn a
spelling test into a copying exercise.

## Running it

```bash
npm install
npm run dev
```

The dev server binds to your network, so the URL it prints also opens on a phone
or tablet on the same wifi. That matters: `speechSynthesis` is missing from some
embedded WebViews, so the drill has to be tried in real mobile Chrome.

```bash
npm test        # the drill logic, no DOM needed
npm run build   # static files into dist/
```

### On a tablet

Install from the link above rather than the dev server, so the service worker
registers and the app keeps working offline. Android's app pinning (Settings →
Security → App pinning) locks the tablet to a single app until a PIN is entered,
which keeps a practice session from drifting into YouTube.

## Where the stars are kept

`localStorage` is not a safe long-term home. One tap on "clear browsing data"
wipes it, Android may evict it under storage pressure, and a Capacitor build
serves from a different origin so nothing would carry over anyway.

So storage sits behind an interface (`src/storage.ts`) with two backends. On the
web it is `localStorage`, and the app asks for persistent storage to avoid
eviction. Inside a Capacitor build it uses the Preferences plugin, which writes
to native app storage outside the WebView. Detection happens at runtime, so the
web build needs no Capacitor packages.

The saved record carries a schema version, and every change goes through a
numbered migration, because this data should outlive several redesigns.

There is a **Copy a backup** button in the grown-ups panel. Use it. A year of
stars should not depend on nobody tapping the wrong settings button.

## Not planned

**No cloud sync.** It would solve multiple devices at the cost of a backend,
accounts, and the legal obligations that arrive the moment a learner's data
leaves the device. Local-only is the design, not a gap in it.

## Privacy

Nothing leaves the device, and nothing is fetched from anyone else. Fredoka and
Andika are served from `src/fonts/`, so there is no request to Google Fonts and
no third party learns that the app was opened. Once installed, there are no
network requests at all.

**Keep real word lists out of version control.** A weekly spelling list belongs
to the person using the app, and published alongside a name it can narrow down a
school or a year level. `.gitignore` already excludes `wordlists/`, `*.wordlist`
and `*.private.*`. The seed words in `src/state.ts` are generic Year 2 examples
and are safe to keep.

## Contributing

Bug reports and issues are very welcome, particularly anything about speech
behaviour on devices I cannot test.

Pull requests are welcome too, though a word of warning about pace: this is a
side project, so reviews can be slow, and I may keep the core drills narrow on
purpose. If you have a bigger idea, open an issue first and we can work out
whether it fits here or is happier as a fork. Forks are genuinely encouraged.
Different learners need different things, and the MIT licence is there so you
can build what yours needs.

## Layout

```
src/
  main.ts       screens, wiring, rendering
  state.ts      saved-record schema, defaults, migrations
  storage.ts    the Store interface and its backends
  content.ts    word parsing, cloze clues, session choice, sum generator
  scoring.ts    star rules, milestones, weekly counters
  speech.ts     text to speech, and coping with its absence
  keypad.ts     pad layouts and key sizing
  dom.ts        small element helpers
tests/          the logic above, no DOM
```

Deployment is a GitHub Actions workflow that builds on every push to `main` and
publishes `dist/` to Pages. `vite-plugin-pwa` generates the service worker and
precaches the whole app, fonts included.

Where next: Capacitor, for an installable APK with native storage and native
text to speech.

## Licence

MIT.
