// lab.wire.js — @openav/sound in the cheyuwu-lab runtime (see packages/mapping/lab.wire.js for the contract).
lab.sound = new Sound({ signals: lab.signals, engine: toneEngine() });
lab.enableSound = async () => { if (!lab.sound.enabled) await lab.sound.enable(); return true; };
const btn = lab.ui.button('🔊 聲音', lab.enableSound);
// 瀏覽器已經允許出聲就不等手勢（哲宇 2026-10-05：「他會一直要我點那個聲音……一直點他才能播出聲音這樣很煩」）。
// Chrome 在同源重新載入後會延續「這個框被點過」（工作台每存一版就重載作品框），自動播放白名單也算：
// 這時新建的 AudioContext 一建好就是 running。不允許時不呼叫 start()——Tone.start() 會一直等，之後的點擊也救不回那個 promise。
const audioAllowed = () => {
  if (window.__oavAudioOK !== undefined) return window.__oavAudioOK;
  let ok = false;
  try {
    const pol = navigator.getAutoplayPolicy?.('audiocontext');
    if (pol) ok = pol === 'allowed';
    else { const C = window.AudioContext || window.webkitAudioContext; if (C) { const c = new C(); ok = c.state === 'running'; c.close?.().catch(() => {}); } }
  } catch { ok = false; }
  return (window.__oavAudioOK = ok);
};
const first = () => { lab.enableSound().then(() => btn && btn.remove()).catch((e) => console.warn('[lab:sound]', e)); };
if (audioAllowed()) first();
// 不允許：第一次手勢自動開（瀏覽器音訊政策要求使用者手勢）
addEventListener('pointerdown', first, { once: true });
addEventListener('keydown', first, { once: true });
