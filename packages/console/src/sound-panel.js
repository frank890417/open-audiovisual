// Sound section — the audio branch's home in the universal side panel.
// Shows the enable button (browser audio policy needs a gesture), engine status
// and, for engines with instruments, the instrument picker (grouped by category,
// switchable while playing, with loading progress and the instrument's credit).
// The engine's own params (sound/*) render in the Params panel like any other
// performable state; an instrument's extra knobs appear there while it plays.
export function buildSoundPanel(root, app) {
  const { sound } = app;
  const panel = document.createElement('div');
  panel.className = 'oav-panel';
  panel.innerHTML = `<h3>L4 · Output — sound</h3><div class="oav-row">
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
  // the picker module is fetched only for shows that have sound
  if (sound.choosable && sound.picker !== false) {
    import('../../sound/picker.js?v=0cfcfd4')
      .then(({ mountSoundPicker }) => mountSoundPicker(panel, sound))
      .catch((e) => console.error('[console] sound picker', e));
  }
  return {
    render() {
      if (sound.enabled && !btn.classList.contains('on')) {
        btn.classList.add('on'); btn.textContent = '🔊 sound on';
        st.textContent = 'engine live · params under Params → sound/*';
      }
    },
  };
}
