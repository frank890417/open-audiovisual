// L1 · Input panel — every input module's home: MIDI device list (multi-device
// mute/unmute), enable buttons for mic analysis, hand tracking, body tracking,
// and the Leap Motion status + skeleton when modules.leap is on. Sources that
// need a user gesture (mic/camera) live here so every show exposes them the
// same way.
export function buildInputPanel(root, app) {
  const { midi, audio, hands, pose, signals } = app;
  const panel = document.createElement('div');
  panel.className = 'oav-panel';
  panel.innerHTML = '<h3>L1 · Input</h3><div class="devs"></div><div class="oav-devrow none outrow"></div><div class="oav-row mods"></div>';
  root.appendChild(panel);
  const devsEl = panel.querySelector('.devs');
  const modsEl = panel.querySelector('.mods');

  // --- MIDI devices (multi-device: each can be muted; slug shown for routing) ---
  const renderDevices = (list) => {
    devsEl.innerHTML = '';
    if (!list?.length) { devsEl.innerHTML = '<div class="oav-devrow none">no MIDI devices</div>'; return; }
    for (const d of list) {
      const row = document.createElement('label');
      row.className = 'oav-devrow';
      const cb = Object.assign(document.createElement('input'), { type: 'checkbox', checked: d.listening });
      cb.addEventListener('change', () => midi.setListening(d.slug, cb.checked));
      row.appendChild(cb);
      row.appendChild(Object.assign(document.createElement('span'), { textContent: d.name }));
      row.appendChild(Object.assign(document.createElement('i'), { textContent: list.length > 1 ? 'midi/' + d.slug + '/…' : '' }));
      devsEl.appendChild(row);
    }
  };
  // the MIDI output the show sends to; a hot-plug switch changes this line (and prints one line in the MIDI log)
  const outEl = panel.querySelector('.outrow');
  const renderOut = () => { outEl.textContent = midi?.out ? `MIDI out → ${midi.out.name}` : 'MIDI out: none'; outEl.title = 'if this port is unplugged the output moves to the next one; your choice returns when it is plugged in again'; };
  if (midi) {
    midi.onDeviceChange = (d) => { renderDevices(d); renderOut(); };
    midi.onOutput?.(renderOut);
    renderDevices(midi.devices());
    renderOut();
  } else { devsEl.remove(); outEl.remove(); }

  // --- gesture-gated sources: mic / hands / body ---
  const mkEnable = (label, obj, enable) => {
    if (!obj) return;
    const btn = document.createElement('button');
    btn.className = 'oav-btn';
    btn.textContent = label;
    btn.addEventListener('click', async () => {
      if (btn.classList.contains('active')) return;
      btn.textContent = '…';
      try { await enable(); btn.classList.add('active'); btn.textContent = label + ' ✓'; }
      catch (e) { btn.textContent = label + ' ✗ retry'; console.error('[input]', e); }
    });
    modsEl.appendChild(btn);
  };
  mkEnable('🎤 mic', audio, () => audio.enableMic());
  mkEnable('🖐 hands', hands, () => hands.enable());
  mkEnable('🕺 body', pose, () => pose.enable());
  if (!modsEl.children.length) modsEl.remove();

  // --- Leap Motion: bridge → service → device status, and the hands it sees (packages/leap/panel.js)
  if (app.leap?.mountPanel) app.leap.mountPanel(panel, { width: 300, simTarget: app.leap.simTarget });

  return { render() {} };
}
