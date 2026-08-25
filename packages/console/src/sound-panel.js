// Sound section — the audio branch's home in the universal side panel.
// Shows the enable button (browser audio policy needs a gesture) and engine
// status; the engine's own params (sound/*) render in the Params panel like
// any other performable state.
export function buildSoundPanel(root, app) {
  const { sound } = app;
  const panel = document.createElement('div');
  panel.className = 'oav-panel';
  panel.innerHTML = `<h3>Sound</h3><div class="oav-row">
    <button class="oav-sound-btn">🔊 enable sound</button>
    <span class="st" style="color:#667;font-size:11px"></span></div>`;
  root.appendChild(panel);
  const btn = panel.querySelector('button');
  const st = panel.querySelector('.st');
  btn.addEventListener('click', async () => {
    if (sound.enabled) return;
    btn.textContent = 'loading engine…';
    try { await sound.enable(); }
    catch (e) { btn.textContent = 'failed — retry'; console.error('[sound]', e); }
  });
  return {
    render() {
      if (sound.enabled && !btn.classList.contains('on')) {
        btn.classList.add('on'); btn.textContent = '🔊 sound on';
        st.textContent = 'engine live · params under Params → sound/*';
      }
    },
  };
}
