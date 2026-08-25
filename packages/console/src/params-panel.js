// Param panel: one row per param — slider (override on drag), value, clear-override
// chip, learn chip (via mapper). Sliders reflect live resolved state each frame.
export function buildParamPanel(root, app) {
  const { params, mapper } = app;
  const panel = document.createElement('div');
  panel.className = 'oav-panel';
  panel.innerHTML = '<h3>L3 · Params</h3>';
  root.appendChild(panel);

  const rows = new Map();
  for (const p of params.schema) {
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
  }

  return {
    render(state) {
      for (const p of params.schema) {
        const row = rows.get(p.key);
        const v = state[p.key];
        row.classList.toggle('ovr', params.isOverridden(p.key));
        const valEl = row.querySelector('.val');
        if (!p.pulse) {
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
