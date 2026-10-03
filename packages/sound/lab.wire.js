// lab.wire.js — @openav/sound in the cheyuwu-lab runtime (see packages/mapping/lab.wire.js for the contract).
lab.sound = new Sound({ signals: lab.signals, engine: toneEngine() });
lab.enableSound = async () => { if (!lab.sound.enabled) await lab.sound.enable(); return true; };
const btn = lab.ui.button('🔊 聲音', lab.enableSound);
// 第一次手勢自動開（瀏覽器音訊政策要求使用者手勢）
const first = () => { lab.enableSound().then(() => btn && btn.remove()).catch((e) => console.warn('[lab:sound]', e)); };
addEventListener('pointerdown', first, { once: true });
addEventListener('keydown', first, { once: true });
