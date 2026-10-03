// lab.wire.js — @openav/osc in the cheyuwu-lab runtime (see packages/mapping/lab.wire.js for the contract).
// 需要 OSC bridge：node runtime/modules/osc/bridges/osc-bridge.js [httpPort=7456] [host=127.0.0.1] [udpPort=3456]
lab.osc = new OscOut(new URLSearchParams(location.search).get('osc') || undefined);
lab.osc.enable();
lab.frame(() => lab.osc.flush());
