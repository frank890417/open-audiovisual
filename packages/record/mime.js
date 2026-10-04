// mime.js — which container/codec MediaRecorder should write. Pure.
//
// MP4 (H.264 + AAC) first: it opens everywhere a performance video goes next
// (Premiere, Final Cut, Instagram, a phone's gallery) without a remux, and
// Chrome encodes H.264 in hardware. Note the exact string: Chrome (tested on
// 154) answers false to the generic 'video/mp4;codecs=avc1,mp4a' but true to a
// profile-qualified 'avc1.640033' (High profile, level 5.1 — enough for 4K30
// and 1080×1920@60). The generic form stays in the list for other browsers.
// WebM (VP9/VP8 + Opus) is the fallback; plain 'video/mp4' is Safari's.

/** Candidate MIME types for a video (+ audio) recording, best first. */
export const VIDEO_MIMES = Object.freeze([
  'video/mp4;codecs=avc1.640033,mp4a.40.2',
  'video/mp4;codecs=avc1,mp4a',
  'video/webm;codecs=vp9,opus',
  'video/webm;codecs=vp8,opus',
  'video/webm',
  'video/mp4',
]);

/** Candidate MIME types for an audio-only recording, best first (AAC .m4a imports into every DAW and editor). */
export const AUDIO_MIMES = Object.freeze([
  'audio/mp4;codecs=mp4a.40.2',
  'audio/webm;codecs=opus',
  'audio/ogg;codecs=opus',
  'audio/mp4',
  'audio/webm',
]);

/** 'video/webm;codecs=vp9' → 'webm' */
const containerOf = (mime) => String(mime).split(';')[0].split('/')[1] || '';

/**
 * The first candidate the browser can record. Pass the browser's check, e.g.
 * `pickMime((m) => MediaRecorder.isTypeSupported(m))`. Returns '' when nothing
 * matches (then let MediaRecorder choose its default).
 * @param {(mime:string) => boolean} isTypeSupported
 * @param {{ audioOnly?: boolean, prefer?: 'mp4'|'webm'|null, candidates?: string[] }} [opts]
 *   `prefer` moves one container to the front (keeping the order inside each group).
 * @returns {string}
 */
export function pickMime(isTypeSupported, { audioOnly = false, prefer = null, candidates = null } = {}) {
  let list = [...(candidates || (audioOnly ? AUDIO_MIMES : VIDEO_MIMES))];
  if (prefer) list = [...list.filter((m) => containerOf(m) === prefer), ...list.filter((m) => containerOf(m) !== prefer)];
  if (typeof isTypeSupported !== 'function') return '';
  for (const m of list) {
    try { if (isTypeSupported(m)) return m; } catch (e) { /* a throwing check counts as "no" */ }
  }
  return '';
}

/**
 * File extension for a recorded MIME type: video/mp4 → mp4, audio/mp4 → m4a,
 * (video|audio)/webm → webm, …/ogg → ogg, video/x-matroska → mkv; unknown → 'bin'.
 * @param {string} mime @returns {string}
 */
export function extFor(mime) {
  const [type = '', sub = ''] = String(mime || '').toLowerCase().split(';')[0].trim().split('/');
  if (sub === 'mp4') return type === 'audio' ? 'm4a' : 'mp4';
  if (sub === 'webm') return 'webm';
  if (sub === 'ogg') return 'ogg';
  if (sub === 'x-matroska') return 'mkv';
  return 'bin';
}
