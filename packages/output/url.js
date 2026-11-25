// @openav/output · url — the clean output address of a show. Pure: no DOM.
//
// Any page built with createShow() becomes a clean output when its address says so: no console, no piano, no overlays,
// a black page with the stage filling it, the cursor gone after a moment. That is the address to give a projector in
// kiosk mode, OBS's Browser Source or TouchDesigner's Web Render TOP:
//
//   …/examples/29-projector-output/?output                     the stage, clean (the output is called "main")
//   …?output=front                                             clean, with the corners saved for "front" in this browser
//   …?output=left&crop=0,0,0.5,1&aspect=32:9                   the left half of a 32:9 stage
//   …?output=front&follow=oav-output                           and its clock follows the show page (a BroadcastChannel:
//                                                              same browser, same machine)
//   …?output=front&follow=oav-output&via=relay                 …over this server's /relay (another browser or machine)
//   …?output&play                                              start the timeline at once (nobody can press Space there)
//
//   output   the output's name (1–32 letters, digits, - or _); empty = "main"
//   crop     x,y,w,h of the stage, 0..1                 aspect   the stage's shape: 1.7778 or 16:9
//   fit      contain (default) · cover · stretch        follow   the channel of the show page that leads (see openOutput)
//   via      relay (this server's /relay) or a ws:// / wss:// address      play   no value: play on load

import { NAME_RE } from './layout.js?v=9a90f849';
import { normalizeCrop, FITS } from './crop.js?v=9a90f849';

const CHANNEL_RE = /^[\w-]{1,32}$/;
const KEYS = ['output', 'crop', 'aspect', 'fit', 'follow', 'via', 'play'];

const warn = (msg) => { try { console.warn('[output] ' + msg); } catch { /* no console */ } };

/** '16:9', '1.7778' → 1.7778; anything else → null */
export function parseAspect(v) {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return Number.isFinite(v) && v > 0 ? v : null;
  const m = /^\s*(\d+(?:\.\d+)?)\s*[:/x]\s*(\d+(?:\.\d+)?)\s*$/.exec(String(v));
  const n = m ? Number(m[1]) / Number(m[2]) : Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * What a page address asks of the output: null when it is not a clean output (no `output` key), else
 * { name, crop, aspect, fit, follow, via, play }. A bad value is dropped with a warning; the page still opens clean.
 * @param {string|URLSearchParams} search  location.search ('?output=front&…') or a URLSearchParams
 * @returns {null | { name:string, crop:{x:number,y:number,w:number,h:number}|null, aspect:number|null, fit:string, follow:string|null, via:true|string|null, play:boolean }}
 */
export function outputQuery(search) {
  const q = search instanceof URLSearchParams ? search : new URLSearchParams(String(search ?? ''));
  if (!q.has('output')) return null;
  let name = q.get('output') || 'main';
  if (!NAME_RE.test(name)) { warn(`?output=${name}: a name is 1–32 letters, digits, - or _; using "main"`); name = 'main'; }
  let crop = null;
  if (q.get('crop')) {
    try { crop = normalizeCrop(q.get('crop').split(',').map(Number)); } catch (e) { warn(`?crop=${q.get('crop')}: ${e.message.replace('[output] ', '')}; showing the whole stage`); }
  }
  const aspect = parseAspect(q.get('aspect'));
  if (q.get('aspect') && aspect === null) warn(`?aspect=${q.get('aspect')}: write 16:9 or 1.7778`);
  let fit = q.get('fit') || 'contain';
  if (!FITS.includes(fit)) { warn(`?fit=${fit}: one of ${FITS.join(', ')}; using contain`); fit = 'contain'; }
  let follow = q.get('follow') || null;
  if (follow && !CHANNEL_RE.test(follow)) { warn(`?follow=${follow}: a channel is 1–32 letters, digits, - or _; not following`); follow = null; }
  const v = q.get('via');
  let via = null;
  if (v === 'relay') via = true;
  else if (v && /^wss?:\/\//.test(v)) via = v;
  else if (v) warn(`?via=${v}: relay, or a ws:// or wss:// address`);
  return { name, crop, aspect, fit, follow, via, play: q.has('play') };
}

/**
 * The clean output address of a page: `base` with the output's keys set (any it had before replaced, the rest kept).
 * @param {string} base  the show page's address (location.href)
 * @param {{ name?:string, crop?:object|null, aspect?:number|string|null, fit?:string, follow?:string|null, via?:true|string|null, play?:boolean }} [o]
 * @returns {string}
 */
export function outputUrl(base, { name = 'main', crop = null, aspect = null, fit = 'contain', follow = null, via = null, play = false } = {}) {
  if (!NAME_RE.test(name)) throw new Error(`[output] outputUrl: a name is 1–32 letters, digits, - or _, got ${JSON.stringify(name)}`);
  if (follow !== null && !CHANNEL_RE.test(follow)) throw new Error(`[output] outputUrl: a channel is 1–32 letters, digits, - or _, got ${JSON.stringify(follow)}`);
  if (!FITS.includes(fit)) throw new Error(`[output] outputUrl: fit must be ${FITS.join(', ')}`);
  const u = new URL(base);
  for (const k of KEYS) u.searchParams.delete(k);
  u.hash = '';
  u.searchParams.set('output', name);
  if (crop) { const c = normalizeCrop(crop); u.searchParams.set('crop', [c.x, c.y, c.w, c.h].map((n) => +n.toFixed(4)).join(',')); }
  const a = parseAspect(aspect);
  if (a !== null) u.searchParams.set('aspect', String(+a.toFixed(4)));
  if (fit !== 'contain') u.searchParams.set('fit', fit);
  if (follow) u.searchParams.set('follow', follow);
  if (via === true) u.searchParams.set('via', 'relay');
  else if (typeof via === 'string' && /^wss?:\/\//.test(via)) u.searchParams.set('via', via);
  if (play) u.searchParams.set('play', '');
  // URLSearchParams writes "output=main&play=" and "%2C" for the commas: both read back the same, but the short form is
  // what a person types into OBS or TouchDesigner, so give that one
  return u.toString().replace(/([?&](?:play|output))=(?=&|$)/g, '$1').replace(/%2C/gi, ',');
}
