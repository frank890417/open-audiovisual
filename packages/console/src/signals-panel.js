// Signal meters: live bars for every continuous signal, flash for pulses,
// plus a scrolling MIDI/OSC log if the app provides one.
export function buildSignalPanel(root, app) {
  const { signals } = app;
  const panel = document.createElement('div');
  panel.className = 'oav-panel';
  panel.innerHTML = '<h3>Signals</h3><div class="sigs"></div><div class="oav-log"></div>';
  root.appendChild(panel);
  const sigsEl = panel.querySelector('.sigs');
  const logEl = panel.querySelector('.oav-log');

  const rows = new Map();
  const pulseFlash = new Map();

  signals.onAny((name, value, meta) => {
    if (meta?.kind === 'pulse') pulseFlash.set(name, performance.now());
  });

  // log hook — app.midi (or anything with onMessage semantics) can feed us
  const log = (dir, text) => {
    const line = document.createElement('div');
    if (dir === 'out') line.className = 'out';
    line.textContent = text;
    logEl.appendChild(line);
    while (logEl.children.length > 60) logEl.removeChild(logEl.firstChild);
    logEl.scrollTop = logEl.scrollHeight;
  };
  if (app.midi && !app.midi.onMessage) app.midi.onMessage = (m) => log(m.dir, m.text);

  return {
    log,
    render() {
      for (const s of signals.list()) {
        let row = rows.get(s.name);
        if (!row) {
          row = document.createElement('div');
          row.className = 'oav-sig' + (s.kind === 'pulse' ? ' pulse' : '');
          row.innerHTML = `<label>${s.name}</label><div class="bar"><i></i></div><span class="val"></span>`;
          sigsEl.appendChild(row);
          rows.set(s.name, row);
        }
        const bar = row.querySelector('i');
        const val = row.querySelector('.val');
        if (s.kind === 'pulse') {
          const at = pulseFlash.get(s.name) || 0;
          const age = performance.now() - at;
          bar.style.width = age < 250 ? (100 * (1 - age / 250)) + '%' : '0%';
          val.textContent = '·';
        } else {
          bar.style.width = (signals.norm(s.name) * 100) + '%';
          val.textContent = typeof s.value === 'number' ? s.value.toFixed(2) : '—';
        }
      }
    },
  };
}
