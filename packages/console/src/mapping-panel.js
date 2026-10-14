// L2 · Mapping panel — the routes, visible: source → target with a mute box
// and a remove chip. The textual little sibling of the coming patch bay
// (docs/design/patchbay.md); same data, humbler view.
//
// 🎛 "map the knobs in order": the LearnWizard (packages/mapping/wizard.js) walks the params one
// by one — turn a knob, it is bound, the next param is armed. Learn adds routes, never replaces.
//
// ⬇ export / ⬆ import / clear: the routes as a file ({ format: 'openav.map', version, world, routes }),
// by button, by dropping a .json anywhere on the page, or by ?map=<url> (packages/show). Whatever was
// skipped (a param this world lacks, a signal nothing here makes) is listed under the buttons.
import { LearnWizard } from '../../mapping/wizard.js?v=f77929d';

export function buildMappingPanel(root, app, opts = {}) {
  const { mapper, params } = app;
  const panel = document.createElement('div');
  panel.className = 'oav-panel';
  panel.innerHTML = `<h3>L2 · Mapping</h3>
    <div class="oav-row"><button class="oav-btn" data-wiz title="turn a knob for each param in turn; Esc stops">🎛 map knobs in order</button></div>
    <div class="oav-wizard" hidden></div>
    <div class="oav-row oav-mapfile"><button class="oav-btn" data-export title="download the routes as a JSON file">⬇ export</button>
      <button class="oav-btn" data-import title="load a map file (or drop one on the page)">⬆ import</button>
      <button class="oav-btn" data-clear title="remove every route">clear</button>
      <input type="file" accept=".json,application/json" hidden></div>
    <div class="oav-mapnote" hidden></div><div class="routes"></div>`;
  root.appendChild(panel);
  const routesEl = panel.querySelector('.routes');
  const wizBtn = panel.querySelector('[data-wiz]'), wizEl = panel.querySelector('.oav-wizard');
  let lastKey = '';
  const noteEl = panel.querySelector('.oav-mapnote'), fileEl = panel.querySelector('input[type=file]');
  const exportBtn = panel.querySelector('[data-export]'), importBtn = panel.querySelector('[data-import]'), clearBtn = panel.querySelector('[data-clear]');
  if (!mapper) panel.querySelector('.oav-mapfile').remove();

  // the order: opts.learnOrder, else the params as declared (skipping hidden ones and any with wizard: false)
  const wizard = mapper && params ? new LearnWizard({
    mapper,
    keys: () => opts.learnOrder || params.schema.filter((p) => !p.hidden && p.wizard !== false).map((p) => p.key),
    onChange: () => paintWizard(),
  }) : null;
  if (!wizard) panel.querySelector('[data-wiz]').parentElement.remove();

  const label = (k) => params.get(k)?.label || k;
  function paintWizard() {
    wizBtn.classList.toggle('active', wizard.active);
    wizBtn.textContent = wizard.active ? '⏹ stop mapping' : '🎛 map knobs in order';
    wizEl.hidden = !wizard.active && !wizard.done;
    wizEl.classList.toggle('done', wizard.done);
    wizEl.innerHTML = '';
    if (wizard.active) {
      const bound = mapper.routesFor(wizard.current).map((r) => r.source);
      wizEl.append('Turn a knob (or touch a control) for ', Object.assign(document.createElement('b'), { textContent: label(wizard.current) }),
        `  (${wizard.index + 1}/${wizard.total})`, bound.length ? `  already: ${bound.join(', ')}` : '');
      const row = Object.assign(document.createElement('div'), { className: 'oav-row' });
      for (const [text, fn] of [['skip', () => wizard.skip()], ['back', () => wizard.back()], ['stop', () => wizard.stop()]]) {
        const b = Object.assign(document.createElement('button'), { className: 'oav-btn', textContent: text }); b.addEventListener('click', fn); row.append(b);
      }
      wizEl.append(row);
    } else if (wizard.done) wizEl.textContent = `Done: ${wizard.added.length} of ${wizard.total} mapped (${wizard.added.map((a) => a.key + ' ← ' + a.source).join(', ') || 'none'}).`;
  }
  wizBtn?.addEventListener('click', () => { if (wizard.active) wizard.stop(); else wizard.start(); });

  // ---- map files ----
  function paintNote() {
    const r = mapper?.report;
    noteEl.hidden = !r;
    if (!r) return;
    noteEl.className = 'oav-mapnote ' + (r.ok ? (r.skipped.length ? 'warn' : 'ok') : 'bad');
    noteEl.textContent = '';
    const where = r.source === 'url' ? `?map=${r.address}` : (r.name || 'file');
    if (!r.ok) { noteEl.textContent = `Could not load ${where}: ${r.error}. Your routes are unchanged.`; return; }
    noteEl.append(`Loaded ${r.added} route${r.added === 1 ? '' : 's'} from ${where}` + (r.crossWorld ? ` (made for “${r.world}”)` : '') + '.');
    if (r.waiting.length) noteEl.append(` ${r.waiting.length} wait${r.waiting.length === 1 ? 's' : ''} for a device to send its first message.`);
    if (r.dropped) noteEl.append(` ${r.dropped} unreadable entr${r.dropped === 1 ? 'y' : 'ies'} ignored.`);
    if (r.skipped.length) {
      noteEl.append(` Skipped ${r.skipped.length}:`);
      const ul = document.createElement('ul');
      for (const k of r.skipped.slice(0, 20)) ul.append(Object.assign(document.createElement('li'), {
        textContent: `${k.signal} → ${k.param} (${k.reason === 'param' ? 'no such param here' : 'no such signal here'})` }));
      if (r.skipped.length > 20) ul.append(Object.assign(document.createElement('li'), { textContent: `… and ${r.skipped.length - 20} more` }));
      noteEl.append(ul);
    }
  }
  async function importFile(file) {
    if (!file) return;
    if (file.size > 256 * 1024) return mapper.setReport({ ok: false, source: 'file', name: file.name, error: 'file is too large for a map (over 256 KB)' });
    try { mapper.importMap(await file.text(), { source: 'file', name: file.name }); }
    catch (e) { mapper.setReport({ ok: false, source: 'file', name: file.name, error: 'could not read the file' }); }
  }
  const isJsonFile = (f) => f && (/\.json$/i.test(f.name) || f.type === 'application/json');
  if (mapper) {
    exportBtn.addEventListener('click', () => {
      const data = JSON.stringify(mapper.exportMap(), null, 2) + '\n';
      const a = Object.assign(document.createElement('a'), {
        href: URL.createObjectURL(new Blob([data], { type: 'application/json' })),
        download: `oav-map-${String(mapper.profile).replace(/[^\w.-]+/g, '-')}.json` });
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    });
    importBtn.addEventListener('click', () => fileEl.click());
    fileEl.addEventListener('change', async () => { const f = fileEl.files[0]; fileEl.value = ''; await importFile(f); });
    let armed = 0;
    clearBtn.addEventListener('click', () => {            // two clicks, no dialog: the first arms, the second removes
      if (!armed) { clearBtn.textContent = 'sure? click again'; armed = setTimeout(() => { armed = 0; clearBtn.textContent = 'clear'; }, 3000); return; }
      clearTimeout(armed); armed = 0; clearBtn.textContent = 'clear'; mapper.clear(); lastKey = '';
    });
    // drop a .json anywhere on the page
    const hasFile = (e) => [...(e.dataTransfer?.types || [])].includes('Files');
    window.addEventListener('dragover', (e) => { if (hasFile(e)) { e.preventDefault(); panel.classList.add('dropping'); } });
    window.addEventListener('dragleave', (e) => { if (!e.relatedTarget) panel.classList.remove('dropping'); });
    window.addEventListener('drop', (e) => {
      panel.classList.remove('dropping');
      const f = [...(e.dataTransfer?.files || [])].find(isJsonFile);
      if (!f) return;
      e.preventDefault(); importFile(f);
    });
  }

  return {
    wizard,
    render() {
      if (!mapper) return;
      wizard?.sync();
      const key = mapper.routes.map(r => `${r.id}${r.enabled === false ? 'm' : ''}`).join(',') + (mapper.learnTarget || '') + '#' + mapper.reportSeq;
      if (key === lastKey) return;          // rebuild only on change
      lastKey = key;
      paintNote();
      routesEl.innerHTML = '';
      if (mapper.learnTarget) {
        const l = document.createElement('div');
        l.className = 'oav-devrow none';
        l.textContent = `LEARN armed: move any signal → ${mapper.learnTarget}`;
        routesEl.appendChild(l);
      }
      if (!mapper.routes.length && !mapper.learnTarget) {
        routesEl.innerHTML = '<div class="oav-devrow none">no routes — click "learn" on a param</div>';
        return;
      }
      for (const r of mapper.routes) {
        const row = document.createElement('div');
        row.className = 'oav-routerow';
        const cb = Object.assign(document.createElement('input'), { type: 'checkbox', checked: r.enabled !== false, title: 'mute/unmute' });
        cb.addEventListener('change', () => { r.enabled = cb.checked; mapper.save?.(); lastKey = ''; });
        row.appendChild(cb);
        row.appendChild(Object.assign(document.createElement('span'), { textContent: `${r.source} → ${r.target}` }));
        const del = Object.assign(document.createElement('button'), { className: 'oav-chip', textContent: '✕', title: 'remove route' });
        del.addEventListener('click', () => { mapper.removeRoute(r.id); lastKey = ''; });
        row.appendChild(del);
        routesEl.appendChild(row);
      }
    },
  };
}
