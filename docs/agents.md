# For AI agents

Worlds are visual code, and coding agents are good at code. A person describes a
performance ("a jellyfish world that blooms on consonant chords"); an agent
writes the world inside a chassis that already handles MIDI, mapping, timeline,
console and backstage. This chapter is what an agent needs to do that well.

## The two rules

1. **Continuous control goes through params; discrete events may use signals.**
   Never read `signals.get(…)` in `update()` for something that varies
   continuously. Declare a param and let a route connect the signal to it.
2. **The shell never knows the work.** Never edit `packages/*` to make one
   example look right. A framework change must make every work better.

The reasoning is in [Core concepts](concepts.md#the-two-rules).

## Start with AGENTS.md

[AGENTS.md](../AGENTS.md) at the repository root is the briefing: what the
framework is, the two rules, how to create a new work, how to verify changes,
and the conventions (vanilla ESM + JSDoc, no build step, no runtime
dependencies, comments that explain the performance reasoning (why a knob feels
right) rather than syntax, path-style signal names declared with `signals.define`).

## The MCP server

The repository ships a Model Context Protocol server: `packages/mcp/server.js`,
zero dependencies, JSON-RPC 2.0 over stdio, one JSON message per line. Claude
Code picks it up from `.mcp.json` when you open the repository. Other clients:

```json
{
  "mcpServers": {
    "openav": {
      "command": "node",
      "args": ["/path/to/open-audiovisual/packages/mcp/server.js"]
    }
  }
}
```

It answers `initialize` (server `openav` 0.1.0, echoing the client's protocol
version, `2024-11-05` if none is given), `tools/list` and `tools/call`. Results
come back as one text item; objects are JSON-encoded. A failing call returns a
JSON-RPC error with code −32000 and a message.

| tool | arguments | returns |
|---|---|---|
| `list_examples` | none | `[{ dir, title, summary }]`: each example's folder, the `<title>` of its `index.html`, and the first comment line of its `main.js` |
| `read_doc` | `doc` (required): `architecture`, `writing-a-world`, `signals`, `show-control`, `roadmap`, `agents`, `readme` | the Markdown text. `agents` is AGENTS.md, `readme` the README; the others are `docs/<name>.md` |
| `scaffold_world` | `slug` (required, kebab-case), `donor` (default `01-hello-particles`) | `{ created, next_steps }`. Copies every file of `examples/<donor>/` into `examples/<next number>-<slug>/` |
| `run_checks` | none | `{ pass, fail, ok }` from `node --test tests/*.test.js` (60 s timeout), or `{ ok: false, output }` with the failing lines |

Good donors for `scaffold_world`: `01-hello-particles` (minimal 2D canvas),
`02-chord-garden` (chord-driven), `03-pose-field` (camera, hands),
`05-prebiotic-flake` (p5 with sound). Start with `read_doc agents`, then
`read_doc writing-a-world`.

## llms.txt and llms-full.txt

- [/llms.txt](../llms.txt) is the short index in the [llmstxt.org](https://llmstxt.org/)
  format: what this is, the core concepts, how to start, every doc and example.
- [/llms-full.txt](../llms-full.txt) is the README, AGENTS.md and the docs in one
  file, for agents that prefer to read everything at once.
- This handbook is plain HTML at `/docs/` (and `/zh/docs/` in Traditional
  Chinese); every word is there without JavaScript. Each section has a stable
  anchor, for example `/docs/#mapping-curves`.

## The create-world skill

`.claude/skills/create-world/SKILL.md` is a Claude Code skill that turns a
description into a runnable example: extract the inputs, the 3–6 performable
params, the events and the acts; copy a donor; write the world; wire the
assembly; verify in the browser; hand back the URL, the param list, the scene
list and the signals it reacts to.

## Poking a running show

Every show made with `createShow()` sets `window.openav` to the whole show, so
an agent driving a browser can inspect and steer it:

```js
openav.signals.list()                                   // every signal, its value and range
openav.params.resolve(openav.timeline.state())          // the current param values
openav.signals.pulse('midi/note/on', { note: 60, vel: 0.8, ch: 1 });   // play a note
openav.timeline.seek(40); openav.timeline.play();       // jump to a scene and play
openav.mapper.routes                                    // the wiring
```

## A prompt to paste

```text
Clone https://github.com/frank890417/open-audiovisual and read AGENTS.md first.
Run `node serve.js` and open http://localhost:8080/examples/01-hello-particles/ to see the smallest complete show.
Create examples/10-<name>/ by copying 01-hello-particles (or call the openav MCP tool scaffold_world), then write a World in its main.js for this piece:

  <describe the performance, e.g. "a jellyfish world that blooms on consonant chords">

Rules from AGENTS.md: continuous control goes through params, and the mapper routes signals to them. Never edit packages/* to make one example look right.
Done means: npm test passes, and the new example loads with zero console errors.
```

## Before handing back

- `npm test` passes (or `run_checks` says `ok`).
- The example loads with zero console errors. The refused `ws://…:7457`
  connection (no backstage monitor running) is expected.
- It reacts to the on-screen piano or QWERTY keys: no hardware required.
- <kbd>Space</kbd> plays the timeline and something evolves.
- Report the URL, the params (what to map to knobs), the scenes, and the signals
  the world listens to.
