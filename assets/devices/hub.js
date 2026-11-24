// /devices/: filter the rows already on the page by kind and manufacturer, and search them by name, alias, id and maker.
// No request: every row carries its words in data-q (written by tools/devices/hub.mjs). Matching follows devices() of
// @openav/devices: every word must be somewhere, ignoring case, spaces and punctuation.
const $ = (s) => document.querySelector(s);
const fold = (s) => String(s).toLowerCase();
const squash = (s) => fold(s).replace(/[^a-z0-9㐀-鿿]+/g, '');

const q = $('#dev-q'), maker = $('#dev-maker'), shown = $('#dev-shown'), none = $('#dev-none');
const rows = [...document.querySelectorAll('.dev-list .dev')];
const groups = [...document.querySelectorAll('.dev-group')];
const kindButtons = [...document.querySelectorAll('.dev-filter [data-kind]')];
let kind = 'all';

function matches(row, tokens) {
  if (kind !== 'all' && row.dataset.kind !== kind) return false;
  if (maker.value && row.dataset.maker !== maker.value) return false;
  if (!tokens.length) return true;
  const hay = row.dataset.q, flat = squash(hay);
  return tokens.every((t) => hay.includes(t) || (squash(t) !== '' && flat.includes(squash(t))));
}

function apply() {
  const tokens = fold(q.value).split(/\s+/).filter(Boolean);
  let n = 0;
  for (const r of rows) { const on = matches(r, tokens); r.hidden = !on; if (on) n++; }
  for (const g of groups) g.hidden = !g.querySelector('.dev:not([hidden])');
  shown.textContent = shown.dataset.tpl.replace('{n}', n).replace('{total}', shown.dataset.total);
  none.hidden = n > 0;
}

for (const b of kindButtons) b.addEventListener('click', () => {
  kind = b.dataset.kind;
  for (const x of kindButtons) x.setAttribute('aria-pressed', String(x === b));
  apply();
});
q.addEventListener('input', apply);
maker.addEventListener('change', apply);
// a link to /devices/#kind-dmx-fixture (the fixture and device pages' breadcrumbs) opens with that kind chosen
const fromHash = /^#kind-([a-z-]+)$/.exec(location.hash);
if (fromHash) { const b = kindButtons.find((x) => x.dataset.kind === fromHash[1]); if (b) b.click(); }
apply();
