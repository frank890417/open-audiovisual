// The README's generated pieces, so its numbers, its example grid and its controller list cannot go stale.
//
// README.md keeps its hand-written text; these markers are replaced by tools/build-examples.mjs (--check compares):
//   <!--gen:NAME-->…<!--/gen:NAME-->        inline or multi-line, the content between is written here (applyBlocks in tools/site/facts.mjs)
//   <!-- facts:start … --> … <!-- facts:end -->   the one-line numbers block (readmeBlock in facts.mjs)
//
// Blocks: badge-controllers, n-devices, n-controls, n-generic, w-examples (Fifteen), w-packages (Twenty-three),
//         devices-line (18 devices, 859 controls), examples-grid, controllers-table,
//         packages-table (every package, by layer: the homepage's groups and one-liners, which tests/site.test.js keeps complete).

import { getFacts, enWords, cap } from '../site/facts.mjs';
import { catalog, nameOf, detailUrl } from '../controllers/page.mjs';
import { routeGroups, exampleUrl, L } from './catalog.mjs';
import { ROUTE_NAMES, ROUTE_INTRO, routeMark } from './strings.mjs';
import { PACKAGE_GROUPS } from '../home/page.mjs';
import homeEn from '../home/en.mjs';

const SITE = 'https://openaudiovisual.com/';
const attr = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const text = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');

function examplesGrid() {
  const cell = (e) => {
    const url = exampleUrl(e.id);
    return `<td width="33%" align="center" valign="top"><a href="${url}"><img src="${e.thumb}" width="260" alt="${attr(L(e.alt, 'en'))}"></a><br><b>${e.num} · ${text(L(e.title, 'en'))}</b><br>${text(L(e.teaches, 'en'))}<br><a href="${url}">play</a> · <a href="${e.dir}">source</a></td>`;
  };
  const out = [`All examples, by route: [openaudiovisual.com/examples/](${SITE}examples/)`, ''];
  for (const g of routeGroups()) {
    out.push(`**${routeMark(g.route)} ${ROUTE_NAMES[g.route][0]}**: ${ROUTE_INTRO[g.route][0]}`, '', '<table>');
    for (let i = 0; i < g.items.length; i += 3) {
      const row = g.items.slice(i, i + 3).map(cell);
      while (row.length < 3) row.push('<td></td>');
      out.push('<tr>', ...row, '</tr>');
    }
    out.push('</table>', '');
  }
  return out.join('\n').replace(/\n$/, '');
}

function controllersTable() {
  const cat = catalog();
  const makers = [...new Set(cat.devices.map((d) => d.p.maker))];
  const SHORT = { 'odd-ball': 'ODD Ball' };   // the product's name starts with the maker's
  const short = (d) => SHORT[d.p.id] || nameOf(d.p, 'en').replace(new RegExp('^' + String(d.p.maker).split(' ')[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s+', 'i'), '');
  return ['| maker | devices (spec sheet with the full MIDI map) |', '|---|---|',
    ...makers.map((m) => `| ${m} | ${cat.devices.filter((d) => d.p.maker === m).map((d) => `[**${short(d)}**](${detailUrl(d.p.id, 'en')})`).join(' · ')} |`)].join('\n');
}

/** Every package, by layer: the same groups and one-liners as the homepage's package list, so a new package cannot be left out. */
function packagesTable() {
  const t = homeEn.start;
  const TAG = { l1: 'L1 ', l2: 'L2 ', l3: 'L3 ', l4: 'L4 ' };
  const cell = (x) => String(x).replace(/\|/g, '\\|');
  const rows = PACKAGE_GROUPS.flatMap((g, gi) => g.pkgs.map((p, i) =>
    `| ${i ? '' : (TAG[g.layer] || '') + t.groups[gi].toLowerCase()} | [\`@openav/${p}\`](packages/${p}/) | ${cell(t.packages[p])} |`));
  return ['| layer | package | role |', '|---|---|---|', ...rows].join('\n');
}

/** name → the text written between its markers. */
export function readmeBlocks(f = getFacts()) {
  return {
    'badge-controllers': `<a href="${SITE}controllers/"><img src="https://img.shields.io/badge/MIDI_controllers-${f.deviceCount}-ff5a1f?style=flat-square&labelColor=0e0e10" alt="${f.deviceCount} MIDI controllers"></a>`,
    'n-devices': String(f.deviceCount),
    'n-controls': String(f.controlCount),
    'n-generic': String(f.genericCount),
    'devices-line': `${f.deviceCount} devices, ${f.controlCount} controls`,
    'w-examples': cap(enWords(f.exampleCount)),
    'w-packages': cap(enWords(f.packageCount)),
    'examples-grid': examplesGrid(),
    'controllers-table': controllersTable(),
    'packages-table': packagesTable(),
  };
}
