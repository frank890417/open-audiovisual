// /check/ strings, English. Shape must match zh.mjs key for key (tools/build-check.mjs refuses to build otherwise).
// Every sentence about a browser or a platform comes from docs/getting-started.md, docs/troubleshooting.md or
// docs/controllers.md, where it carries its source; the check page repeats it and links to that section.

export default {
  meta: {
    title: 'Device check · what this device can do with open-audiovisual',
    description: 'One page that checks this browser for Web MIDI, microphone, camera, graphics and the local OSC bridge, and says what to do about each. Nothing runs until you press a button.',
    ogDescription: 'Check this device: Web MIDI, microphone, camera, graphics and the local bridge, with one line of advice for each.',
    name: 'Device check',
    crumb: 'Device check',
  },

  hero: {
    eyebrow: 'Device check',
    title: 'What can this device do?',
    lede: 'This page looks at your browser and says what works with open-audiovisual, what needs one more step, and what to do about it. Green works. Yellow works with a step or a limit. Red is blocked.',
    promise: 'Nothing runs until you press a button, and nothing leaves your device. MIDI inputs are listed, never played, and no MIDI output is ever opened.',
    summary: '{ok} green · {warn} yellow · {bad} red · {idle} not tested yet',
  },

  state: { ok: 'Works', warn: 'Check', bad: 'Blocked', idle: 'Not tested' },

  rows: {
    browser: { title: 'Browser and system', idle: 'Looking…', doc: 'Which browser' },
    secure: { title: 'Secure page', idle: 'Looking…', doc: 'If the camera or microphone will not start' },
    midi: { title: 'Web MIDI', idle: 'Looking…', button: 'List my MIDI devices', note: 'Asks the browser for MIDI permission and lists the names of your inputs. It never opens an output.', doc: 'If no MIDI devices appear' },
    mic: { title: 'Microphone', idle: 'Not tested. Press the button to ask for the microphone; you see a level for a few seconds, then it stops.', button: 'Test the microphone', note: 'The browser asks first.', doc: 'If the camera or microphone will not start' },
    camera: { title: 'Camera', idle: 'Not tested. Press the button to ask for the camera; you see the picture for a few seconds, then it stops.', button: 'Test the camera', note: 'The browser asks first.', doc: 'If the camera or microphone will not start' },
    graphics: { title: 'Graphics', idle: 'Looking…', doc: 'All troubleshooting' },
    local: { title: 'Bridges on this computer', idle: 'Not tested. Press the button to try the OSC bridge (port 7456) and the backstage monitor (port 7457) on this computer. Nothing connects until you press.', button: 'Test the connection', note: 'Connects to 127.0.0.1 only. Nothing else is contacted.', doc: 'Chrome asks about the local network' },
  },

  docLabel: 'Read',
  actions: { copy: 'Copy results', copied: 'Copied', copyFailed: 'Select the text below and copy it.', copyHint: 'Plain text, for pasting into a chat or an issue. It stays on your device until you paste it.' },
  allDocs: 'All troubleshooting',
  links: { controllers: 'Controller library', docs: 'Docs' },

  // runtime messages (check.js); {x} are filled in by the script
  js: {
    browser: {
      is: '{name} {version} on {os}.',
      chrome: 'Chrome and Edge have Web MIDI: use them for a show.',
      firefox: 'Firefox has Web MIDI on desktop after you install its site-permission add-on.',
      safari: 'Safari has no Web MIDI. You can still play every controller on screen.',
      ios: 'On an iPhone or iPad every browser is WebKit underneath, so none has Web MIDI. You can play on screen and use a phone as a controller.',
      mobile: 'On a phone you can play on screen. To plug in a controller, open the page in Chrome or Edge on a computer.',
      other: 'Not one of the browsers we test with. Chrome or Edge on a computer is the safe choice for a show.',
    },
    secure: {
      ok: 'This page is secure ({where}), so the microphone and camera can work.',
      bad: 'This page is not secure ({where}): the browser blocks the camera and microphone. Use http://localhost or https://.',
      file: 'This page was opened from a file. Open it through http://localhost or https:// so the camera and microphone can work.',
      https: 'https',
      localhost: 'localhost',
    },
    midi: {
      yes: 'This browser has Web MIDI. Nothing has been asked yet.',
      no: 'This device has no Web MIDI, so a hardware controller cannot connect here. You can still play on screen with your fingers. To plug in yours, open this page in Chrome or Edge on a computer.',
      asking: 'Waiting for your answer in the browser…',
      none: 'Allowed, but no MIDI input was found. Plug the controller in; if it was plugged in after the page loaded and still does not show, reload.',
      list: '{n} MIDI input(s): {names}.',
      denied: 'MIDI was blocked. Allow it in the address bar and press the button again.',
      failed: 'The browser could not open MIDI ({reason}).',
    },
    media: {
      none: 'This page cannot reach the {what}: the browser only offers it on https:// or http://localhost.',
      asking: 'Waiting for your answer in the browser…',
      micOk: 'The microphone works: {label}. Loudest level heard: {level}%.',
      micQuiet: 'The microphone opened but we heard nothing. Make some noise and press again, or check which input your system uses.',
      camOk: 'The camera works: {label}, {size}.',
      denied: 'The browser blocked the {what}. Allow it for this site in the address bar and press again. On macOS the browser also needs access in System Settings → Privacy & Security.',
      missing: 'No {what} was found on this device.',
      busy: 'The {what} could not start ({reason}). Another program may be using it.',
      mic: 'microphone',
      camera: 'camera',
      unnamed: 'unnamed device',
    },
    graphics: {
      ok: 'WebGL 2: {gl2}. WebGPU: {gpu}.',
      weak: 'Only WebGL 1 is available. WebGPU: {gpu}.',
      bad: 'No WebGL: worlds that draw with WebGL (p5 WEBGL, WebToe) will not show. Try another browser.',
      yes: 'yes',
      no: 'no',
    },
    local: {
      testing: 'Trying 127.0.0.1…',
      bridge: 'OSC bridge (port 7456): {r}',
      monitor: 'Backstage monitor (port 7457): {r}',
      answered: 'answered',
      silent: 'no answer',
      ok: 'Something on this computer answered.',
      none: 'Nothing answered. Either the bridge and monitor are not running (npm run bridge, npm run monitor), or Chrome asked about the local network and you chose Block.',
      publicPage: 'This page is public https, so Chrome asks before it may reach your computer.',
    },
    copy: { head: 'open-audiovisual device check', ua: 'User agent' },
  },
};
