// @openav/align · cal-store — where a calibration and the align mode's state are kept. With a bridge (an object an
// Electron preload exposes) the files are written by the app: each save also keeps a timestamped backup and survives a
// power cut. Without one, the browser's localStorage, with the last 20 saves as backups. The same interface both ways.
//
// localStorage keys: <prefix>/calibration, <prefix>/state, <prefix>/backups. The default prefix is 'oav-align'. A page
// that used art-align's default ('art-align') finds its calibration still: while nothing is saved under the new prefix,
// load(), listBackups() and readBackup() read the old keys (never write them). The first save writes the new ones.

const DEFAULT_PREFIX = 'oav-align';
const OLD_PREFIX = 'art-align';

function local(storage) {
  return {
    get(k, d) { try { const v = storage?.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
    has(k) { try { return storage?.getItem(k) != null; } catch { return false; } },
    set(k, v) { try { storage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } },
  };
}
const defaultStorage = () => { try { return globalThis.localStorage ?? null; } catch { return null; } };

/**
 * A store for calibrations: load(), saveCalibration(cal), saveState(state), listBackups(), readBackup(name), exportTo(cal),
 * importFrom(), and for an app with displays: displays(), nextDisplay(), setAutostart(on). Every method returns a Promise.
 * @returns {object}
 */
export function createCalStore({ bridge = null, prefix = DEFAULT_PREFIX, storage = defaultStorage() } = {}) {
  const kit = bridge;
  if (kit) {
    return {
      kind: 'electron',
      load: () => kit.load(),                              // → { calibration, state, paths }
      saveCalibration: (cal) => kit.saveCalibration(cal),  // → { ok, file, backup }
      saveState: (st) => kit.saveState(st),
      listBackups: () => kit.listBackups(),                // → [{ name, savedAt }], newest first
      readBackup: (name) => kit.readBackup(name),          // → calibration
      exportTo: (cal) => kit.exportCalibration(cal),       // save as (a dialog)
      importFrom: () => kit.importCalibration(),           // open (a dialog) → calibration | null
      displays: () => kit.displays(),
      nextDisplay: () => kit.nextDisplay(),
      setAutostart: (on) => kit.setAutostart(on),
    };
  }
  const ls = local(storage);
  const keys = (p) => ({ cal: `${p}/calibration`, state: `${p}/state`, bak: `${p}/backups` });
  const K = keys(prefix);
  // the old keys are read only while the new ones are empty, and only for the default prefix
  const old = prefix === DEFAULT_PREFIX ? keys(OLD_PREFIX) : null;
  const read = (k, oldK, d) => (ls.has(k) || !old ? ls.get(k, d) : ls.get(oldK, d));
  return {
    kind: 'browser',
    async load() { return { calibration: read(K.cal, old?.cal, null), state: read(K.state, old?.state, {}), paths: { calibration: 'localStorage' } }; },
    async saveCalibration(cal) {
      const savedAt = new Date().toISOString();
      const bak = read(K.bak, old?.bak, []);
      bak.unshift({ name: savedAt, savedAt, cal });
      ls.set(K.bak, bak.slice(0, 20));
      return { ok: ls.set(K.cal, cal), file: 'localStorage', backup: savedAt };
    },
    async saveState(st) { return { ok: ls.set(K.state, st) }; },
    async listBackups() { return read(K.bak, old?.bak, []).map(({ name, savedAt }) => ({ name, savedAt })); },
    async readBackup(name) { return read(K.bak, old?.bak, []).find((b) => b.name === name)?.cal ?? null; },
    async exportTo(cal) {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([JSON.stringify(cal, null, 2)], { type: 'application/json' }));
      a.download = `${prefix}-calibration-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '')}.json`; a.click();
      return { ok: true, file: a.download };
    },
    async importFrom() {
      return new Promise((res) => {
        const i = document.createElement('input'); i.type = 'file'; i.accept = '.json,application/json';
        i.onchange = async () => { try { res(JSON.parse(await i.files[0].text())); } catch { res(null); } };
        i.click();
      });
    },
    async displays() { return []; },
    async nextDisplay() { return null; },
    async setAutostart() { return { ok: false, why: 'a browser page cannot start itself when the machine boots' }; },
  };
}
