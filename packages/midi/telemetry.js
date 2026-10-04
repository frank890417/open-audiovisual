// @openav/midi · telemetry — one anonymous "this was used here" hit, so the
// project can see where its controllers and shows end up. Documented in
// packages/midi/README.md §Telemetry and the handbook (docs/controllers.md).
//
// What it sends — to Google Analytics 4 (the openaudiovisual.com property), at
// most once per page load for each event + kind + profile:
//   oav_embed_load        an <oav-controller>, createController() or the iframe started
//   oav_hardware_connect  a real controller was plugged in and matched a profile
//   oav_show_start        createShow() started a show
//   params: oav_kind (element | headless | iframe | show), oav_profile (profile id),
//           oav_host (origin of the page it runs on — never the path, query or title),
//           oav_version
// What it never sends: anything anyone plays, page paths or titles, cookies, or a
// stable id (the client id is random for each page load, so visitors can't be followed).
//
// Off switches: <oav-controller telemetry="off">, createController(p, { telemetry: false }),
// createShow({ telemetry: false }), the iframe's ?telemetry=0, or
// globalThis.OPENAV_TELEMETRY = false before anything loads. Do Not Track and
// Global Privacy Control are honoured. Silent on localhost, LAN addresses, file://
// and openaudiovisual.com itself (the site has its own analytics).
//
// No gtag.js is loaded: a page that runs its own Google Analytics keeps its
// dataLayer and cookies untouched. A strict Content-Security-Policy that blocks
// google-analytics.com simply drops the hit.

export const MEASUREMENT_ID = 'G-1YG2JHK2WT';
export const VERSION = '0.1.0';
const ENDPOINT = 'https://www.google-analytics.com/g/collect';
const OWN_SITE = /(^|\.)openaudiovisual\.com$/i;

/** Hosts where nothing is sent: development, the LAN, and the project's own site. */
export function quietHost(hostname = '') {
  const h = String(hostname).toLowerCase().replace(/^\[|\]$/g, '');
  if (!h) return true;
  if (OWN_SITE.test(h)) return true;
  if (h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.local') || h.endsWith('.test')) return true;
  if (h === '::1' || /^127\./.test(h) || /^0\./.test(h)) return true;
  if (/^(10\.|192\.168\.|169\.254\.)/.test(h) || /^172\.(1[6-9]|2\d|3[01])\./.test(h)) return true;
  if (/^(fc|fd|fe80)[0-9a-f:]*$/.test(h)) return true;             // IPv6 private / link-local
  return false;
}

/** Should a hit go out from this environment? Pure, so it can be tested. */
export function telemetryAllowed({ protocol = '', host = '', flag, dnt, gpc } = {}) {
  if (flag === false) return false;
  if (dnt === '1' || dnt === 'yes' || gpc === true) return false;
  if (protocol !== 'https:' && protocol !== 'http:') return false;
  return !quietHost(host);
}

/** The GA4 collect URL for one event (no cookies; the ids are per page load). */
export function hitUrl({ event, params = {}, cid, sid, origin }) {
  const q = new URLSearchParams({
    v: '2', tid: MEASUREMENT_ID, cid, sid: String(sid), sct: '1', seg: '1', _s: '1', _ss: '1', _fv: '1',
    en: event, dl: origin + '/', _et: '1',
  });
  for (const [k, v] of Object.entries({ oav_version: VERSION, ...params })) {
    if (v !== undefined && v !== null && v !== '') q.set('ep.' + k, String(v).slice(0, 100));
  }
  return ENDPOINT + '?' + q.toString();
}

/** Origin of the page a kind of embed runs on: the parent page for the iframe, this page otherwise. */
export function hostOrigin(kind, g = globalThis) {
  if (kind === 'iframe') {
    const anc = g.location?.ancestorOrigins;
    if (anc && anc.length) return anc[0] === 'null' ? '' : anc[0];      // [0] = the page that holds this frame
    try { return g.document?.referrer ? new URL(g.document.referrer).origin : ''; } catch { return ''; }
  }
  return g.location?.origin || '';
}

const sent = new Set();
let ids = null;

/** Send one event (browser only; a no-op in Node, in tests and wherever it isn't allowed). */
export function track(event, params = {}, { enabled = true } = {}) {
  const g = globalThis;
  if (!enabled || typeof g.navigator === 'undefined' || !g.location) return false;
  const origin = hostOrigin(params.oav_kind, g);
  let url;
  try { url = origin && new URL(origin); } catch { url = null; }
  if (!url || !telemetryAllowed({ protocol: url.protocol, host: url.hostname, flag: g.OPENAV_TELEMETRY,
    dnt: g.navigator.doNotTrack ?? g.doNotTrack, gpc: g.navigator.globalPrivacyControl })) return false;
  const key = [event, params.oav_kind, params.oav_profile].join('|');
  if (sent.has(key)) return false;
  sent.add(key);
  ids ||= { cid: `${Math.floor(Math.random() * 2 ** 31)}.${Math.floor(Date.now() / 1000)}`, sid: Math.floor(Date.now() / 1000) };
  const hit = hitUrl({ event, params: { ...params, oav_host: url.origin }, cid: ids.cid, sid: ids.sid, origin: url.origin });
  try {
    if (g.navigator.sendBeacon?.(hit)) return true;
    g.fetch?.(hit, { method: 'POST', mode: 'no-cors', keepalive: true, credentials: 'omit' }).catch(() => {});
    return true;
  } catch { return false; }
}
