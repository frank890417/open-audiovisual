// @openav/surface · platform — the phone-shaped chores: no scroll, no zoom,
// screen stays on, fullscreen, haptics. Each is best-effort and silent on
// browsers that lack it (iPhone Safari has no fullscreen API or vibrate; that
// is fine — the surface is built to work without them).

/** Make the page behave like an instrument panel, not a web page. */
export function lockViewport() {
  if (typeof document === 'undefined') return () => {};
  let m = document.querySelector('meta[name=viewport]');
  if (!m) { m = document.createElement('meta'); m.name = 'viewport'; document.head.appendChild(m); }
  m.content = 'width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover';
  const st = document.createElement('style');
  st.textContent = 'html,body{margin:0;height:100%;overflow:hidden;overscroll-behavior:none;touch-action:none;-webkit-text-size-adjust:100%}';
  document.head.appendChild(st);
  // iOS ignores user-scalable=no; these three stop pinch-zoom, rubber-banding and double-tap zoom
  const stop = (e) => e.preventDefault();
  document.addEventListener('gesturestart', stop);
  document.addEventListener('gesturechange', stop);
  const tm = (e) => { if (!(e.target instanceof Element) || !e.target.closest('input,textarea')) e.preventDefault(); };
  document.addEventListener('touchmove', tm, { passive: false });
  return () => { document.removeEventListener('gesturestart', stop); document.removeEventListener('gesturechange', stop); document.removeEventListener('touchmove', tm); st.remove(); };
}

/** Screen Wake Lock, re-acquired when the tab comes back (the OS drops it on hide). */
export function keepAwake() {
  let lock = null, want = true;
  const get = async () => { try { if (want && navigator.wakeLock && document.visibilityState === 'visible') lock = await navigator.wakeLock.request('screen'); } catch {} };
  const vis = () => { if (document.visibilityState === 'visible') get(); };
  document.addEventListener('visibilitychange', vis);
  get();
  return { release() { want = false; document.removeEventListener('visibilitychange', vis); try { lock?.release(); } catch {} } };
}

/** True when the page can ask for fullscreen (not iPhone Safari). */
export const canFullscreen = () => typeof document !== 'undefined' && !!(document.documentElement.requestFullscreen || document.documentElement.webkitRequestFullscreen);
export function toggleFullscreen() {
  const d = document, el = d.documentElement;
  if (d.fullscreenElement || d.webkitFullscreenElement) (d.exitFullscreen || d.webkitExitFullscreen).call(d);
  else (el.requestFullscreen || el.webkitRequestFullscreen)?.call(el, { navigationUI: 'hide' });
}

/** navigator.vibrate where it exists (Android Chrome). `enabled` lets a page turn it off. */
export function haptic(ms, enabled = true) { try { if (enabled && navigator.vibrate) navigator.vibrate(ms); } catch {} }
