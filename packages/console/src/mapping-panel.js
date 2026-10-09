// L2 · Mapping panel — the routes, visible: source → target with a mute box
// and a remove chip. The textual little sibling of the coming patch bay
// (docs/design/patchbay.md); same data, humbler view.
//
// 🎛 "map the knobs in order": the LearnWizard (packages/mapping/wizard.js) walks the params one
// by one — turn a knob, it is bound, the next param is armed. Learn adds routes, never replaces.
import { LearnWizard } from '../../mapping/wizard.js?v=0cfcfd4';

export function buildMappingPanel(root, app, opts = {}) {
  const { mapper, params } = app;
  const panel = document.createElement('div');
  panel.className = 'oav-panel';
  panel.innerHTML = `<h3>L2 · Mapping</h3>
    <div class="oav-row"><button class="oav-btn" data-wiz title="turn a knob for each param in turn; Esc stops">🎛 map knobs in order</button></div>
    <div class="oav-wizard" hidden></div><div class="routes"></div>`;
  root.appendChild(panel);
  const routesEl = panel.querySelector('.routes');
  const wizBtn = panel.querySelector('[data-wiz]'), wizEl = panel.querySelector('.oav-wizard');
  let lastKey = '';

  // the order: opts.learnOrder, else the params as declared (skipping hidden ones and any with wizard: false)
  const wizard = mapper && params ? new LearnWizard({
    mapper,
    keys: () => opts.learnOrder || params.schema.filter((p) => !p.hidden && p.wizard !== false).map((p) => p.key),
    onChange: () => paintWizard(),
  }) : null;
  if (!wizard) panel.querySelector('.oav-row').remove();

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

  return {
    wizard,
    render() {
      if (!mapper) return;
      wizard?.sync();
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
