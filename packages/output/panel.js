// @openav/output · panel — "L4 · Output" on the desk: per output, open it (as a mirror or as a page), edit its corners,
// show its test pattern, and see whether it is open and how large; under them, the venue's layout to a file and back.
// It is operator UI: on a clean output page (?output) the desk is not there, and neither is this.

const btn = (label, title) => {
  const b = document.createElement('button');
  b.type = 'button'; b.className = 'oav-btn'; b.textContent = label; if (title) b.title = title;
  b.style.cssText = 'padding:3px 8px;font-size:11px';
  return b;
};

/**
 * @param {object} rig   what createOutputs() returned
 * @param {HTMLElement|null} el  where to put the panel; null = the console (above its first panel)
 */
export function mountOutputPanel(rig, el = null) {
  const desk = el || document.querySelector('.oav-desk');
  if (!desk) return null;
  const panel = document.createElement('div');
  panel.className = 'oav-panel oav-operator oav-output-panel';
  panel.innerHTML = '<h3>L4 · Output</h3>';
  const first = el ? null : desk.querySelector(':scope > .oav-panel');      // under the transport and the scenes, above Curves
  if (first) first.before(panel); else desk.appendChild(panel);
  const note = document.createElement('div');
  note.style.cssText = 'color:#8691a8;font-size:11px;margin:4px 0 0;min-height:14px;word-break:break-all';
  const rows = new Map();
  for (const name of rig.names) {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;flex-wrap:wrap;align-items:center;gap:4px;margin:4px 0';
    const label = document.createElement('b');
    label.textContent = name; label.style.cssText = 'min-width:44px;color:#cfd6e4;font-size:12px';
    const open = btn('Open', 'open the output window: a mirror of this stage (from a click)');
    const page = btn('Page', 'open the output as a second page running the world itself, following this page\'s clock');
    const edit = btn('Edit', 'edit the corners in the output window (E there)');
    const grid = btn('Grid', 'the test pattern in the output window (G there)');
    const state = document.createElement('span');
    state.style.cssText = 'color:#8691a8;font-size:11px;margin-left:auto';
    const tryOpen = (mode) => {
      try { rig.open(name, { mode }); note.textContent = ''; }
      catch (e) { note.textContent = e.message.replace('[output] ', ''); }
    };
    open.onclick = () => tryOpen('mirror');
    page.onclick = () => tryOpen('page');
    edit.onclick = () => { if (!rig.get(name)) tryOpen('mirror'); rig.edit(name); };
    grid.onclick = () => { if (!rig.get(name)) tryOpen('mirror'); rig.pattern(name); };
    row.append(label, open, page, edit, grid, state);
    panel.appendChild(row);
    rows.set(name, { state, edit, grid });
  }
  const foot = document.createElement('div');
  foot.style.cssText = 'display:flex;gap:4px;margin-top:6px';
  const exp = btn('Export layout', 'the corners, flips, turns and borders of every output, as a JSON file (open-audiovisual/output@1)');
  const imp = btn('Import layout', 'load a layout file: it is checked, saved in this browser and applied to open windows');
  const file = document.createElement('input');
  file.type = 'file'; file.accept = 'application/json,.json'; file.hidden = true;
  exp.onclick = () => {
    const doc = rig.exportLayout();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(doc, null, 2) + '\n'], { type: 'application/json' }));
    a.download = 'output-layout.json';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    note.textContent = `exported ${Object.keys(doc.outputs).length} output${Object.keys(doc.outputs).length > 1 ? 's' : ''}`;
  };
  imp.onclick = () => file.click();
  file.onchange = async () => {
    const f = file.files?.[0]; file.value = '';
    if (!f) return;
    try { const names = rig.importLayout(await f.text()); note.textContent = `imported: ${names.join(', ') || 'nothing'}`; }
    catch (e) { note.textContent = e.message.replace('[output] ', '').split('\n')[0]; console.error(e.message); }
  };
  const lead = btn('Lead', 'let pages at a clean address with &follow=oav-output (OBS, TouchDesigner, another machine) follow this show');
  lead.onclick = async () => {
    try { const l = await rig.lead(); lead.classList.add('active'); note.textContent = `leading on oav-output ${l.transport?.room ? '(relay)' : '(this browser)'}: ${rig.url(rig.names[0], { follow: 'oav-output', via: l.transport?.room ? true : null })}`; }
    catch (e) { note.textContent = e.message; }
  };
  foot.append(exp, imp, lead, file);
  panel.append(foot, note);
  const timer = setInterval(() => {
    if (!panel.isConnected) { clearInterval(timer); return; }
    for (const [name, r] of rows) {
      const o = rig.get(name);
      let text = 'closed';
      if (o) {
        try {
          const w = o.window;
          text = `${o.mode} · ${w.innerWidth}×${w.innerHeight}${w.document.fullscreenElement ? ' · full' : ''}`;
        } catch { text = o.mode; }
      }
      if (r.state.textContent !== text) r.state.textContent = text;
      r.edit.classList.toggle('active', !!o?.view?.editing);
      r.grid.classList.toggle('active', !!o?.view?.patterned);
    }
  }, 400);
  return { el: panel, dispose() { clearInterval(timer); panel.remove(); } };
}
