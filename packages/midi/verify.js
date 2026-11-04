// @openav/midi · verify — how sure a profile is of each number, and who checked it on what.
//
// Three levels, read off the control itself so old files keep their meaning:
//   verified: true    a person moved this control on a real unit and the message matched
//   (no field)        the number comes from a cited source; nobody has checked it on a unit yet
//   verified: false   not confirmed: our best reading (a `note` says why)
//
// `verified: true` is a claim, so it has to carry its evidence. A profile keeps a log of checks, one entry per
// sitting, and the validator refuses a true that no entry with `method: "hardware"` backs:
//
//   "verifications": [{
//     "date": "2026-11-12", "by": "Che-Yu Wu", "method": "hardware",
//     "firmware": "1.0.4", "os": "macOS 26.1", "browser": "Chrome 142", "port": "Minilab3 MIDI",
//     "results": { "knob1": "match", "pad3": { "result": "corrected", "was": { "msg": "note", "ch": 10, "note": 38 } } }
//   }]
//
// A check on a virtual port (IAC, loopMIDI) or the page's simulator shows that the tool works, not that the
// device does, so it is logged with its own method and never turns anything true.

export const VERIFY_METHODS = ['hardware', 'virtual', 'simulated'];
export const VERIFY_RESULTS = ['match', 'corrected', 'mismatch', 'absent'];
const CONFIRMS = ['match', 'corrected'];   // the two results that say "on this unit, this control sends what the file now says"
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const text = (v) => typeof v === 'string' && v.trim() !== '';

const realDate = (s) => {
  const m = DATE_RE.exec(s || ''); if (!m) return false;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3];
};
const resultOf = (r) => (typeof r === 'string' ? r : r?.result);

/** Every problem with a profile's verification log and its `verified: true` marks, as strings ([] = valid). */
export function validateVerifications(p) {
  const errs = [], log = p.verifications;
  const controls = new Set((p.controls || []).map((c) => c?.id));
  const sysex = Array.isArray(p.sysex?.messages) ? p.sysex.messages : [];
  const messages = new Set(sysex.map((m) => m?.id));
  if (log !== undefined && !Array.isArray(log)) return ['verifications must be an array'];
  for (const [i, v] of (log || []).entries()) {
    const at = `verifications[${i}]`;
    if (!v || typeof v !== 'object') { errs.push(`${at}: must be an object`); continue; }
    if (!realDate(v.date)) errs.push(`${at}: date must be a real YYYY-MM-DD`);
    if (!text(v.by)) errs.push(`${at}: by must say who checked`);
    if (!VERIFY_METHODS.includes(v.method)) errs.push(`${at}: method must be one of ${VERIFY_METHODS.join(' ')}`);
    if (v.method === 'hardware') for (const k of ['firmware', 'os', 'browser']) if (!text(v[k])) errs.push(`${at}: a hardware check must record ${k} (write "unknown" when you cannot read it)`);
    if (!v.results || typeof v.results !== 'object' || Array.isArray(v.results)) { errs.push(`${at}: results must be an object of control id → result`); continue; }
    for (const [id, r] of Object.entries(v.results)) {
      const known = id.startsWith('sysex:') ? messages.has(id.slice(6)) : controls.has(id);
      if (!known) errs.push(`${at}: results names "${id}", which is not in this profile`);
      if (!VERIFY_RESULTS.includes(resultOf(r))) errs.push(`${at}: results.${id} must be one of ${VERIFY_RESULTS.join(' ')}`);
      if (resultOf(r) === 'corrected' && !(r.was && typeof r.was === 'object')) errs.push(`${at}: results.${id} is corrected, so it must keep the old message in "was"`);
      if (r && typeof r === 'object' && r.led !== undefined && !['match', 'mismatch'].includes(r.led)) errs.push(`${at}: results.${id}.led must be match or mismatch`);
    }
  }
  const backed = (id) => (log || []).some((v) => v?.method === 'hardware' && CONFIRMS.includes(resultOf(v.results?.[id])));
  for (const c of p.controls || []) {
    if (!c || c.verified === undefined) continue;
    if (typeof c.verified !== 'boolean') errs.push(`control "${c.id}": verified must be true or false`);
    else if (c.verified && !backed(c.id)) errs.push(`control "${c.id}": verified is true but no hardware check in verifications confirms it`);
  }
  for (const m of sysex) if (m?.verified === true && !backed(`sysex:${m.id}`)) errs.push(`sysex message "${m.id}": verified is true but no hardware check in verifications confirms it`);
  return errs;
}

/** How sure the file is of a control: 'hardware' (checked on a unit), 'source' (from a cited document), 'unconfirmed'. */
export const evidenceOf = (c) => (c?.verified === true ? 'hardware' : c?.verified === false ? 'unconfirmed' : 'source');

/**
 * The newest check of one control (or `sysex:<id>`), with the sitting's details beside its result; null when nobody has.
 * Dates are YYYY-MM-DD, so they sort as text; of two checks on one day the later entry wins.
 */
export function verificationOf(p, id) {
  let best = null;
  for (const v of p?.verifications || []) {
    const r = v.results?.[id];
    if (r === undefined || (best && v.date < best.date)) continue;
    const { results, ...sitting } = v;
    best = { ...sitting, ...(typeof r === 'string' ? { result: r } : r) };
  }
  return best;
}

/** One line of numbers for a page or a tool: how many controls are at each level, and the newest check. */
export function verificationSummary(p) {
  const out = { controls: 0, hardware: 0, source: 0, unconfirmed: 0, checks: (p?.verifications || []).length, latest: null };
  for (const c of p?.controls || []) { out.controls++; out[evidenceOf(c)]++; }
  for (const v of p?.verifications || []) if (!out.latest || v.date >= out.latest.date) out.latest = { date: v.date, by: v.by, method: v.method, firmware: v.firmware ?? null };
  return out;
}
