// Param panel: one row per param — slider (override on drag), value, clear-override
// chip, learn chip (via mapper). Sliders reflect live resolved state each frame.
// Who holds each param is on its row (docs/mapping.md#who-holds-a-value): the name in yellow with ✋ for a hand (this
// slider, params.override(), sound.set()), in blue with ⇄ for a route; the tooltip of the name and of ✕ says which.

/** What the desk says about who holds a param, from params.holder(key): 'the timeline', 'hand', 'sound.set', 'route midi/cc/74', … */
export function heldText(h) {
  if (!h) return 'the timeline';
  if (h.kind === 'route') return `route ${h.label || h.source || ''}`.trim();
  return h.label || h.kind || 'hand';
}

export function buildParamPanel(root, app) {
  const { params, mapper } = app;
  const panel = document.createElement('div');
  panel.className = 'oav-panel';
  panel.innerHTML = '<h3>L3 · Params</h3>';
  root.appendChild(panel);

  const rows = new Map();
  const addRow = (p) => {
    const row = document.createElement('div');
    row.className = 'oav-param';
    if (p.pulse) {
      row.innerHTML = `
        <label title="${p.key}">${p.label || p.key}</label>
        <button class="oav-btn" data-fire>fire</button>
        <span class="val"></span>
        <button class="oav-chip" data-learn>learn</button>
        <span></span>`;
      row.querySelector('[data-fire]').addEventListener('click', () => params.firePulse(p.key));
    } else {
      row.innerHTML = `
        <label title="${p.key}">${p.label || p.key}</label>
        <input type="range" min="${p.min}" max="${p.max}" step="${p.step || (p.max - p.min) / 200}" value="${p.def}">
        <span class="val"></span>
        <button class="oav-chip" data-clear title="clear override">✕</button>
        <button class="oav-chip" data-learn>learn</button>`;
      const slider = row.querySelector('input');
      slider.addEventListener('input', () => params.override(p.key, Number(slider.value)));
      row.querySelector('[data-clear]').addEventListener('click', () => params.clearOverride(p.key));
    }
    row.querySelector('[data-learn]')?.addEventListener('click', () => mapper?.learn(p.key));
    panel.appendChild(row);
    rows.set(p.key, row);
  };
  for (const p of params.schema) addRow(p);
  // an older Params (or a stand-in) without holder(): an override is somebody's hand, as far as the desk can tell
  const holderOf = (k) => (typeof params.holder === 'function' ? params.holder(k) : params.isOverridden(k) ? { kind: 'hand', label: 'hand' } : null);

  return {
    render(state) {
      // params registered after mount (a newly picked instrument's knobs) get their row here
      if (rows.size < params.schema.length) for (const p of params.schema) if (!rows.has(p.key)) addRow(p);
      for (const p of params.schema) {
        const row = rows.get(p.key);
        const v = state[p.key];
        // p.hidden: registered but not in play right now (another instrument's knob)
        const hide = p.hidden ? 'none' : '';
        if (row.style.display !== hide) row.style.display = hide;
        if (hide) continue;
        const h = holderOf(p.key), kind = h ? (h.kind === 'route' ? 'route' : 'hand') : '';
        row.classList.toggle('ovr', !!h);
        if (row.dataset.held !== kind || row._heldText !== (h ? h.label : '')) {      // the tooltips change only when the holder does
          row.dataset.held = kind; row._heldText = h ? h.label : '';
          const who = heldText(h);
          row.querySelector('label').title = `${p.key} · ${h ? 'held by ' + who : who + ' plays it'}`;
          const x = row.querySelector('[data-clear]');
          if (x) x.title = h ? `give ${p.key} back to the timeline (held by ${who})` : 'clear override';
        }
        const valEl = row.querySelector('.val');
        if (!p.pulse && typeof v === 'number') {
          const slider = row.querySelector('input');
          if (document.activeElement !== slider) slider.value = v;
          valEl.textContent = (Math.abs(v) >= 100 ? v.toFixed(0) : v.toFixed(2));
        }
        const learnChip = row.querySelector('[data-learn]');
        if (learnChip && mapper) {
          const bound = mapper.routesFor(p.key).length;
          learnChip.classList.toggle('learn', mapper.learnTarget === p.key);
          learnChip.classList.toggle('bound', bound > 0 && mapper.learnTarget !== p.key);
          learnChip.textContent = mapper.learnTarget === p.key ? 'learn…' : (bound ? `${bound}⇄` : 'learn');
          learnChip.title = bound ? mapper.routesFor(p.key).map(r => r.source).join(', ') + ' (click chip = learn more; see mapper API to unbind)' : 'map a signal to this param';
        }
      }
    },
  };
}
