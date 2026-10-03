# Lab integration (the `"lab"` field)

[cheyuwu-lab](https://lab.cheyuwu.com) runs sketches in plain `<script>` pages, so it builds a
classic-script bundle of each OAV package it wants. Instead of a hard-coded list, the lab's generator
(`tools/lab-dev/build-modules.mjs`) scans `packages/*/package.json` and builds every package that declares a
`"lab"` field (an object, or an array when one package yields several modules). No declaration, no module.

| key | meaning |
|---|---|
| `module` | output name, `runtime/modules/<module>.js` (lowercase, digits, `-`) |
| `kind` | `"build"` (default, bundle the code) or `"declare"` (only announce a module the lab implements itself) |
| `files` | source files to bundle, relative to `packages/`; relative `import`s between them are resolved, JSON imports are inlined |
| `exports` | names exposed on `window.OpenAV` |
| `wire` | optional file (relative to the package dir) run inside the module scope; `lab` is `window.lab`. It plugs the package into `lab.signals` / `lab.params` |
| `autowire` | one sentence on what the wiring does (goes into the lab's `oav-manifest.json`) |
| `remoteTab` | optional `{id, label, icon, entry}`: adds a tab to the phone `/remote` app |
| `since` | version or month |

Rules: relative imports only, no runtime dependencies, no build step in OAV itself. The generator is
idempotent and has a `--check` mode (exit 3 = OAV has something new to regenerate).
