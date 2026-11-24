// @openav/midi · profiles/imported — where the files of the controllers imported from QLC+ live (tools/import-qlc.mjs writes this file).
// The list is imported-list.js. This file reads its own address (import.meta.url), so it is ES-module only: the lab bundles the list
// and leaves this file out. The data is Apache-2.0: see NOTICE at the root of the repository.

import { IMPORTED, importedRow } from './imported-list.js?v=6b091ec6';

export { IMPORTED };

/** Where an imported profile's JSON lives, or null for an id or short name that is not one of them. */
export function importedUrl(ref) {
  const hit = importedRow(ref);
  return hit ? new URL(`./imported/${hit.id}.json`, import.meta.url).href : null;
}
