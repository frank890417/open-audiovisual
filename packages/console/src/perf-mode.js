// Performance mode — fullscreen teleprompter for the performer.
// Shows: current scene title + note (big) · next scene (dim) · clock + scene countdown.
// Toggle with T (wired in index.js) or .toggle().
export function buildPerformanceMode(app) {
  const { timeline } = app;
  const el = document.createElement('div');
  el.className = 'oav-perf';
  el.innerHTML = `<div class="clockline"></div><div class="now"></div><div class="next"></div>`;
  document.body.appendChild(el);
  const nowEl = el.querySelector('.now');
  const nextEl = el.querySelector('.next');
  const clockEl = el.querySelector('.clockline');
  let on = false;

  const fmt = (t) => { const n = t < 0; t = Math.abs(t); return (n ? '-' : '') + Math.floor(t / 60) + ':' + String(Math.floor(t % 60)).padStart(2, '0'); };

  return {
    toggle() { on = !on; el.classList.toggle('on', on); return on; },
    get active() { return on; },
    render() {
      if (!on) return;
      const i = timeline.sceneIndexAt();
      const sc = timeline.scenes[i];
      const nx = timeline.scenes[i + 1];
      nowEl.textContent = sc ? `${sc.title || sc.id || ''}${sc.note ? ' — ' + sc.note : ''}` : '';
      nextEl.textContent = nx ? `next: ${nx.title || nx.id} @ ${fmt(nx.t)}` : 'next: (end)';
      const remain = timeline.sceneEnd(i) - timeline.t;
      clockEl.textContent = `${fmt(timeline.t)} · scene −${fmt(Math.max(0, remain))}`;
    },
  };
}
