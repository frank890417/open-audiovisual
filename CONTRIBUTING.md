# Contributing to open-audiovisual

The most useful contribution is a controller that is not in the [library](https://openaudiovisual.com/controllers/) yet. A controller is one JSON file in `packages/midi/profiles/`; the pages on the site are generated from it.

## Ask for a controller

[Open a controller request](https://github.com/frank890417/open-audiovisual/issues/new?template=controller-request.yml). It asks for the brand and model, whether you have the unit, whether you could help test, and a link to the manual. Whoever has the unit can usually make the profile fastest.

## Add a controller

1. Copy the closest file in `packages/midi/profiles/`, or a generic layout.
2. Write each control's type and message from the manual's MIDI implementation chart.
3. Cite every source. Mark anything you could not confirm `"verified": false` with a note.
4. `validateProfile(profile)` lists every problem; `npm test` checks every shipped profile.
5. Try it with `<oav-controller profile="./my-device.json">`.
6. Register it in `packages/midi/profiles/index.js`, run `node tools/build-controllers.mjs` (it writes the device's two pages and the sitemap), and open a pull request.

No manual: choose a generic layout, press Learn, move your controls in order, and keep `controller.exportMapping()` as the start of a profile.

The long version, with the schema and every control type, is in [docs/controllers.md](docs/controllers.md) and [packages/midi/README.md](packages/midi/README.md).

## Open a pull request

The pull request template has a checklist for a profile: sources, `verified` marks, `validateProfile`, `npm test`, and a screenshot or video. Tell us which unit and firmware you checked it on.

## Something wrong in a controller's data

Every number on a device page comes from its JSON file. Each page has a "Report it on GitHub" link; say which firmware you checked.

## Using a coding agent

That works too. Point it at [AGENTS.md](AGENTS.md); the MCP server in this repo (`node packages/mcp/server.js`) has the tools it needs.

## Everything else

`npm test` runs the whole suite and should pass before you open a pull request. The repository has no build step and no dependencies; please keep it that way.
