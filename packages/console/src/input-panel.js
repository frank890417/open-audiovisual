// L1 · Input panel — every input module's home: MIDI device list (multi-device
// mute/unmute), and enable buttons for mic analysis, hand tracking, body
// tracking. Sources that need a user gesture (mic/camera) live here so every
// show exposes them the same way.
export function buildInputPanel(root, app) {
  const { midi, audio, hands, pose, signals } = app;
  const panel = document.createElement('div');
  panel.className = 'oav-panel';
  panel.innerHTML = '<h3>L1 · Input</h3><div class="devs"></div><div class="oav-row mods"></div>';
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
  if (midi) {
    midi.onDeviceChange = renderDevices;
    renderDevices(midi.devices());
  } else devsEl.remove();

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

  return { render() {} };
}
