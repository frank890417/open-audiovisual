<!-- Adding or fixing a controller profile? Fill in this list. Anything else: delete it and describe the change. -->

## What changed

<!-- Which controller (brand, model, firmware you checked), or what else. -->

## Controller profile checklist

- [ ] Every control's message comes from a source, and each source is cited in `sources` (title, link, what it confirmed).
- [ ] Anything not confirmed by a document or by the real unit is marked `"verified": false` with a note.
- [ ] `validateProfile(profile)` returns an empty list.
- [ ] The profile is registered in `packages/midi/profiles/index.js`.
- [ ] `node tools/build-controllers.mjs` was run, and its pages are in this PR.
- [ ] `npm test` passes.
- [ ] A screenshot or a short video of it playing in `<oav-controller profile="…">` (or on the real unit).

## Anything else
