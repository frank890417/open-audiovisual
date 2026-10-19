# AGENTS.md — for AI coding agents working in this repo

> Worlds are visual code. Agents are good at code. This framework is the bridge:
> a human describes a performance ("a jellyfish world that blooms on consonant
> chords"), you write a World inside a chassis that already handles MIDI, mapping,
> timeline, console, and backstage. (Positioning inspired by
> [open-slide](https://github.com/1weiho/open-slide), which does this for slides.)

## What this is

A zero-build, zero-dependency ESM framework for audiovisual performance.
Four layers + two spines — the contracts are in [docs/architecture.md](docs/architecture.md):

- **Input** (`packages/midi`, `audio`, `chord`, `pose`, `leap`) → publishes named **signals**
- **Mapping** (`packages/mapping`) → routes signals to **params** (curves, smoothing, live learn)
- **World** (`packages/stage`) → algorithmic system that reads params, renders anything
- **Output** (`packages/osc`, MIDI out) + **Timeline** + **Score & Director** (`packages/score`: a show as segment lengths) + **Console** + **Monitor**

Full handbook (every chapter, verified against the code): https://openaudiovisual.com/docs/ —
sources in `docs/`, one file for language models at `/llms-full.txt`.

## The two rules you must not break

1. **Continuous control goes through params; discrete events may use signals.**
   A world that reads `signals.get('midi/cc/74')` in `update()` is welded to one
   controller and can no longer be driven by the timeline or a dancer. Declare a
   param, let the mapper route to it.
2. **The shell never knows the work.** Never edit `packages/*` to make one
   example look right. Framework changes must make every example better.

## MCP: the fast path

This repo ships an MCP server (`.mcp.json` is pre-wired — Claude Code picks it
up automatically; other agents: `node packages/mcp/server.js` over stdio).
Tools: `list_examples` · `read_doc` (start with `agents`, then
`writing-a-world`) · `scaffold_world` (donor-based) · `run_checks` · controller profiles:
`list_controllers` · `read_profile` · `validate_profile` · `scaffold_profile`. The manual
path below works without it.

## How to create a new work (the common request)

1. Copy `examples/01-hello-particles/` to `examples/<nn>-<name>/`.
2. Write the World object in `main.js` — the full contract is
   [docs/writing-a-world.md](docs/writing-a-world.md); it fits in ~20 lines minimum.
3. Declare params (what the piece is performed WITH), scenes and automation
   (what the timeline does), and any `signals.on(...)` event reactions.
4. Update the import map in `index.html` only if you use extra packages
   (`@openav/chord`, `@openav/pose`…). A show with structure (cuts, cues, a hold, segment modules) declares
   `score: { cuts, modules }` in `createShow()`: [docs/score.md](docs/score.md), example `13-score-director`. Signal names: [docs/signals.md](docs/signals.md).
5. Verify: `node serve.js` → open `http://localhost:8080/examples/<nn>-<name>/` —
   QWERTY keys A–L are the no-hardware MIDI fallback (tick *keyboard* in the console first); Space plays the timeline.

## Documenting a public name

Every public name has an entry in the API reference, <https://openaudiovisual.com/docs/reference/>, and the build keeps it
that way: a name without an entry, an entry for a name that no longer exists, an example that does not parse, and an example
that does not run are all red. Public names are: every global, callback, `OAVp5.*` member and loader option of
`p5/oav-p5.js`, every export in a package's `package.json` `"exports"`, and the tools of `packages/mcp`.

**Two layers, one source of truth.**
- What the *code* says is never typed: the name, its kind (variable, function, event, class, constant, option), the signature and
  default values, a class's public members, the source file and line. `tools/reference/scan.mjs` reads them on every build.
  Change a signature and the page changes with it; rename or remove a name and the build fails until you touch its entry.
- What a *person* writes lives beside the code: `p5/reference/<area>.mjs` for oav-p5, `packages/<package>/reference.mjs` for a
  package. Plain data, `export default { name: { … } }`, English and Chinese side by side. `p5/reference/mic.mjs` (`micLevel`)
  is the model entry.

**The loop when you add (or rename, or remove) a name:**

```bash
node tools/build-reference.mjs --missing      # a paste-ready stub for every name without an entry
# write the entry (and delete the entry of a name you removed)
node tools/build-reference.mjs                # regenerates docs/reference/, zh/docs/reference/ and reference.json
node --test tests/reference.test.js           # the gates, with the message that says what to fix
PW=<playwright> node p5/test/reference-smoke.cjs   # every example and claim in a real headless Chromium (CI runs it too)
```

Never edit `docs/reference/index.html`, `zh/docs/reference/index.html` or `docs/reference/reference.json` by hand: they are
generated and `--check` (inside `tools/release.sh`) rejects a hand edit. `tools/reference/undocumented.json` is the ledger of
names still waiting for an entry; it may only shrink (`node tools/build-reference.mjs --prune-ledger` drops the ones that have an
entry now). Do not add to it: write the entry.

**What an entry holds** (the checks are in `tools/reference/model.mjs`, `checkEntry`):

| field | |
|---|---|
| `group` | a category id from `tools/reference/categories.mjs` |
| `summary` `{ en, zh }` | one sentence that stands alone: it is the line in lists, search results and "related" cards |
| `description` `[{ en, zh }]` | what it is, how to use it, its unit and range, when it updates, what to do first, what to watch out for |
| `value` | variables: `{ type, range, en, zh }`; options: `{ type, options, default, en, zh }` |
| `params` `[{ name, type, optional, default, en, zh }]` | must match the names the code declares, in order (a parameter read from `arguments` says `viaArguments: true`) |
| `returns`, `needs`, `notes`, `related`, `keywords`, `tbd` | `needs` = what must happen before it has a value; `tbd` = what you could not confirm (the page shows "To be confirmed": never guess) |
| `examples` `[{ code, caption: { en, zh }, run, needs }]` | at least one for an oav-p5 name |
| `claims` `[{ before, expr, equals \| min, max, moves }]` | what the entry says about a value, checked in a running sketch |

**Write it like p5.js does.** The first sentence defines the thing. Then how to use it, the unit and range, when the value
changes, what must happen before it has a value (the microphone permission, a click), and the one thing that surprises people.
Examples go from the smallest that shows the point (about 8 lines), to a realistic use, to the gotcha; each is a complete sketch
with `setup()` and `draw()` that runs when pasted into OpenProcessing, **without** the loader line (the page adds it when you copy
or run), with a one-sentence caption saying what you will see. An example about a loading option starts with
`window.OAV_P5 = { … };`: that line has to run before oav-p5 loads, so the page puts the loader line right after it. Code comments stay short and English, so both languages share one
program. Write only what the code does; what you could not read out of it goes in `tbd`.

## Verifying changes

- `npm test` — pure-logic tests (chord analysis, timeline, mapping). Add cases
  for any logic you touch; browser-only code is exercised via the examples.
- Manual smoke: every example must load with zero console errors (the
  `ws://…7457` monitor reconnect warning is expected when no relay runs).
- `window.openav` is exposed in every example for devtools/scripted poking.
- Shipping: `tools/release.sh "message"` is the only way to deploy (a push to `main`
  is a deploy). It builds, tests, commits, stamps, pushes and checks the live site in
  a fixed order; see [RELEASING.md](RELEASING.md) for why.

## Conventions

- Vanilla ESM + JSDoc. No TypeScript, no build step, no runtime dependencies —
  a `<script type="module">` must be enough. This is a hard constraint, not taste.
- Comments explain *performance reasoning* (why a knob feels right), not syntax.
- New signals: path-style, source-first (`breath/pressure`), declared with
  `signals.define(name, {min, max})` so meters work.
- Keep the dark console theme; stage-readable contrast beats pretty.
