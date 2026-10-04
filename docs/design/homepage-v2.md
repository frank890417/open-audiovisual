# Design: homepage v2

*Status: implemented on `feat/homepage-v2`, preview only. 2026-10-03.*

The old landing page already had the right idea: its hero was the framework
running (piano → signals → mapper → params → world, with meters). v2 keeps that
idea and makes it the whole page. Everything else is information architecture
for three kinds of visitor, each of whom should know what to do within ten seconds.

## Who arrives, and what they need

| visitor | first question | where the answer is |
|---|---|---|
| artist / performer (doesn't read code) | what is this, what does it make, can I use it? | hero sentence + the instrument + **Works** (thumbnails) + plain-word glossary |
| creative coder | how do I run it, what's the architecture, what do I write? | **Start** (3 commands, 20-line world, packages by layer, docs) |
| AI agent | what is this, where are the contracts, how do I begin? | `/llms.txt`, `/llms-full.txt`, JSON-LD, semantic HTML, **For agents** block (copyable prompt + MCP config) |

The hero routes all three explicitly: a row of three doors under the headline
("I perform" → works · "I write code" → start · "I'm an agent" → llms.txt).

## Section order (each answers one question)

1. **Hero / instrument** (`#play`) — *what is it, and can I touch it?*
   One-sentence definition, then a playable instrument built from the real
   packages. Three doors.
2. **How it works** (`#how`) — *what are signals, mappings, params, worlds?*
   The four layers as a signal path, each with the architecture doc's own
   one-liners ("what is happening" / "what it means" / "how it behaves" /
   "how it leaves"), a plain sentence, a live specimen value from the hero,
   and its packages. Then the spines (timeline, console, monitor, phones), the
   two rules, and a glossary (`<dl>`).
3. **Works** (`#works`) — *what does it make?* Nine examples as museum wall
   labels: screenshot, number, title, inputs ("materials"), one plain
   sentence, open / source links, artwork credit where it applies.
   Then a compact, un-numbered band, **WebToe** (`#webtoe`) — *what engine
   draws work 04?* The sister project in three sentences, one editor
   screenshot, links to `/webtoe/` (the full page) and the live editor.
   WebToe's violet appears only as a marker dot.
4. **Start** (`#start`) — *how do I run it and write my own?* clone + `node serve.js`;
   a world in 20 lines; all 20 packages grouped by layer; docs.
5. **For AI agents** (`#agents`) — *what should an agent do here?* A prompt to
   paste into Claude Code / Cursor, the MCP config and its four tools, and the
   machine-readable files.
6. **Lineage** (`#lineage`) — *where did it come from?* The Last Input
   (C-LAB Taiwan Sound Lab / IRCAM, 2026), libmapper, WebToe; the positioning
   line from the README; what's next (roadmap).
7. Footer — license, author, every machine-readable entry point.

Old URLs: `examples/*` are untouched. The old page had no section anchors, so
nothing external can break; v2 adds stable ids (`#play #how #works #webtoe #start #agents #lineage`).

## Visual direction

- **The mechanism is the ornament.** No illustrations, no gradient cards. The
  only graphics are things the framework actually does: a patch bay with wires
  whose dots move when a signal moves, a scrolling piano-roll score, an
  oscilloscope graticule, meters with numbers.
- **Harmonograph hero world.** The world drawn in the hero is a harmonograph —
  the pendulum drawing machine that turned musical intervals into figures.
  Each held note is a pendulum at its pitch ratio. A consonant chord draws a
  clean figure; a cluster draws a tangle; that is the `@openav/chord`
  analyzer made visible, through a route (`chord/consonance → order`).
- **Type.** Archivo (variable width; expanded heavy for headings — reads like
  equipment silkscreen) + DM Mono for every signal and param name. Self-hosted
  woff2, no third-party requests.
- **Color.** Near-black ink, bone text, one signal color (vermilion `#ff5a1f`)
  for "live" and primary actions. The four layer colors are the console's own
  (input green, mapping blue, world gold, output violet) and appear only where
  they encode a layer — so the homepage and the examples read as one system.
- **Motion with a reason.** Things move only when a signal moves. With
  `prefers-reduced-motion`, the simulated performer does not autoplay and wire
  dots stand still; the instrument still answers your hands.

## The hero instrument

Built with `@openav/core` (Signals, Params, Loop), `@openav/mapping`,
`@openav/stage`, `@openav/keys` (KeysPiano + SimPlayer) and `@openav/chord`.
Sound (`@openav/sound`, Tone.js), MIDI (`@openav/midi`) and mic
(`@openav/audio`) load only when their switch is pressed.

- **Play:** tap/click the keys; with the instrument focused, QWERTY A–L
  (Z/X octave); drag on the stage (x → hue, y → twist). Touch works the same.
- **Autoplay:** the SimPlayer plays on arrival (the page is alive), and stops
  the moment you play — it is your instrument now.
- **Readouts:** chord name + consonance, voices, fps on the stage; the score
  strip shows the last seconds of notes.
- **Patch bay:** rendered from `mapper.routes` — the wires are the real data,
  not a picture of it. Routes that wait for hardware (`audio/rms`,
  `midi/cc/1`) are drawn dimmed until you switch the device on. `pointer/y`
  and `midi/cc/1` both feed `twist`: many-to-many, visibly.
- No JS: the stage shows a still frame and the patch bay is a readable list.

## Agent layer

- `/llms.txt` (llmstxt.org format, English, links the Chinese page) and
  `/llms-full.txt` (generated by `tools/build-home.mjs`: README + AGENTS +
  docs in one file).
- `<script type="application/ld+json">` SoftwareSourceCode, one per page,
  `inLanguage` en / zh-Hant-TW.
- `<link rel="alternate" type="text/markdown" href="/llms.txt">`.
- Every claim on the page is in the HTML (no content only in canvas or JS).
- The visible "For AI agents" block: a copyable task prompt, the MCP config,
  the four MCP tools, links to AGENTS.md and the `/create-world` skill.

## Two languages, one template

English lives at `/` (default), Traditional Chinese at `/zh/`, the same
convention as cheyuwu.com. Both are complete static HTML (crawlers and agents
read the Chinese page without running JS). To keep them from drifting:

- `tools/home/page.mjs` is the only structure: section order, ids, links,
  code, signal names. `tools/home/en.mjs` and `tools/home/zh.mjs` are string
  tables with the same shape (the generator refuses to build otherwise).
- `node tools/build-home.mjs` writes `index.html`, `zh/index.html` and
  `llms-full.txt`; `--check` fails when the committed files are stale.
  Run `node tools/stamp-version.mjs` afterwards, as before every deploy.
- `tests/home.test.js` (part of `npm test`) checks: same string-table shape,
  committed output matches the template, same six sections in the same
  order, same heading counts, the same links one to one, `lang`, canonical,
  `hreflang` (en / zh-Hant / x-default) and JSON-LD `inLanguage` per page,
  every local link and asset exists, every `#anchor` has a target.
- The header switch (EN | 中文) is two real links. Clicking one remembers the
  choice (`localStorage['oav.lang']`) and carries the section you are reading
  (`/zh/#works` ↔ `/#works`). No automatic redirect: a crawler or a shared
  link always gets the page it asked for.
- Chinese copy is written for Taiwanese readers, plain explanatory tone, terms
  in Chinese with the English name on first use; checked with the
  muse-prose-check gate (HARD rules at zero).

## Files

```
index.html  zh/index.html  generated, committed (all content, semantic)
tools/home/page.mjs        the template; en.mjs / zh.mjs the strings
tools/build-home.mjs       generator (+ --check); tests/home.test.js
assets/home/home.css       the page
assets/home/home.js        the instrument (imports the real packages)
assets/home/fonts/         Archivo + DM Mono, woff2, OFL
assets/home/works/*.webp   example screenshots (headless Chrome)
assets/home/og.png         social card
llms.txt  llms-full.txt  robots.txt  sitemap.xml
docs/design/og-card.html   source of og.png
```
