# @openav/mcp

Glue · a zero-dependency Model Context Protocol server for coding agents
(JSON-RPC 2.0 over stdio, one message per line). An agent can list the
examples, read the framework docs, scaffold a new example, run the tests, and work with
MIDI controller profiles (list, read, validate, scaffold).
It is a program, not a module: there is nothing to import.

```bash
node packages/mcp/server.js
```

Claude Code picks it up from the repository's `.mcp.json`. Other clients:

```json
{ "mcpServers": { "openav": { "command": "node", "args": ["/path/to/open-audiovisual/packages/mcp/server.js"] } } }
```

## Tools

| tool | arguments | returns |
|---|---|---|
| `list_examples` | none | `[{ dir, title, summary }]`: each example's folder, its `<title>` and the first comment line of `main.js` |
| `read_doc` | `doc` (required): `architecture`, `writing-a-world`, `signals`, `show-control`, `score`, `roadmap`, `agents`, `readme` | the Markdown text; `agents` = AGENTS.md, `readme` = README.md, the rest `docs/<name>.md` |
| `scaffold_world` | `slug` (required, kebab-case), `donor = '01-hello-particles'` | `{ created, next_steps }`; copies `examples/<donor>/` to `examples/<next number>-<slug>/` |
| `run_checks` | none | `{ pass, fail, ok }` from `node --test tests/*.test.js` (60 s timeout), or `{ ok: false, output }` |
| `list_controllers` | none | `{ count, controllers: [{ id, short, name, maker, kind, controls, unverified, url }] }`: every shipped MIDI profile, its control mix (`{ knob: 8, pad: 8, keys: 25 }`), how many controls are still flagged unverified, and its page `https://openaudiovisual.com/controllers/<id>/` |
| `read_profile` | `id` (required): a profile id or its `short` | `{ id, url, unverified, profile, mapping }`: the profile JSON as shipped, and a readable MIDI map (control, type, `CC 74, ch 1`, signal `midi/<short>/<id>`, verified) |
| `validate_profile` | `profile` (required): an object or a JSON string | `{ ok, problems, conflicts }`: the problems `validateProfile` finds, plus clashes with shipped profiles (same `id`, same `short`, overlapping `match.ports`) |
| `scaffold_profile` | `maker`, `model`, `controls` (all required): `[{ type, count, from? }]` | `{ profile, problems, unverified, next_steps }`: a skeleton that passes `validateProfile`, every number a placeholder with `"verified": false`, and the steps to source and register it. Nothing is written to disk |

It answers `initialize` (server `openav` 0.1.0), `tools/list` and `tools/call`. Results come
back as one text item, objects JSON-encoded; a failing call is a JSON-RPC error, code -32000.

Full reference: [docs](https://openaudiovisual.com/docs/#packages-openav-mcp) · [The MCP server](https://openaudiovisual.com/docs/#agents-the-mcp-server)
