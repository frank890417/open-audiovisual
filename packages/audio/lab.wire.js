// lab.wire.js — @openav/audio in the cheyuwu-lab runtime (see packages/mapping/lab.wire.js for the contract).
lab.audio = new AudioAnalyzer({ signals: lab.signals });
lab.enableMic = async () => { await lab.audio.enableMic(); return true; };
lab.ui.button('🎤 麥克風', lab.enableMic);
lab.frame(() => lab.audio.update());
