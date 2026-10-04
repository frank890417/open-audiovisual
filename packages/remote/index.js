// @openav/remote — the phone / iPad end-node app, and the runner-side adapter.
//   mountRemote(el, opts)   the app: tabs 感測 · 琴鍵 · 控制台 (phone/iPad side)
//   mountRemoteHost(opts)   the show side: relay runner + surface publisher + feedback (host.js)
export { mountRemote } from './app.js?v=35d96ac';
export { PhoneSensors, attachTouchPad, localSensors } from './sensors.js?v=35d96ac';
