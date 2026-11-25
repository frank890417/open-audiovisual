// @openav/dmx · fixtures/imported — the fixtures imported from the Open Fixture Library, one at a time (tools/import-ofl.mjs writes
// this file). The list is imported-list.js; this file imports a fixture's JSON when it is asked for, by a path relative to
// itself (no import.meta, so it runs wherever the package does). The data is MIT (Open Fixture Library): see NOTICE.

import { IMPORTED_FIXTURES, importedFixtureRow } from './imported-list.js?v=4d84c85b';

export { IMPORTED_FIXTURES };

/** Where an imported fixture's JSON is inside @openav/dmx ("fixtures/imported/<id>.json"), or null for an id that is not one. */
export function importedFixturePath(id) {
  const hit = importedFixtureRow(id);
  return hit ? `fixtures/imported/${hit.id}.json` : null;
}

/** The fixture profile (open-audiovisual/fixture@1) of an imported fixture, imported when it is asked for. Pass it to a Patch:
 *  new Patch({ profiles: [await loadImportedFixture(id)] }), or patch.add({ profile: it, … }). */
export async function loadImportedFixture(id) {
  const hit = importedFixtureRow(id);
  if (!hit) throw new Error(`no imported fixture "${id}"`);
  return (await import(`./imported/${hit.id}.json`, { with: { type: 'json' } })).default;
}
