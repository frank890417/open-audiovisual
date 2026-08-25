// L2 · Mapping panel — the routes, visible: source → target with a mute box
// and a remove chip. The textual little sibling of the coming patch bay
// (docs/design/patchbay.md); same data, humbler view.
export function buildMappingPanel(root, app) {
  const { mapper } = app;
  const panel = document.createElement('div');
  panel.className = 'oav-panel';
  panel.innerHTML = '<h3>L2 · Mapping</h3><div class="routes"></div>';
  root.appendChild(panel);
  const routesEl = panel.querySelector('.routes');
  let lastKey = '';

  return {
    render() {
      if (!mapper) return;
      const key = mapper.routes.map(r => `${r.id}${r.enabled === false ? 'm' : ''}`).join(',') + (mapper.learnTarget || '');
      if (key === lastKey) return;          // rebuild only on change
      lastKey = key;
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
