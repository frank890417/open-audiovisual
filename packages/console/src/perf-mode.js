// Performance mode — fullscreen teleprompter for the performer.
// Shows, large and high-contrast (readable across a stage): the current scene's title and note ·
// what the operator does in it (its `acts`) · seconds left in it · the next scene · a HOLD banner
// while the show waits for you · a red line when a segment module has been switched off.
// Toggle with T (wired in index.js), click the screen, or .toggle().
//
// Scenes from a score carry `acts` (an array of strings); any scene may carry one or a `note`.
const fmt = (t) => { const n = t < 0; t = Math.abs(t); return (n ? '-' : '') + Math.floor(t / 60) + ':' + String(Math.floor(t % 60)).padStart(2, '0'); };

export function buildPerformanceMode(app) {
  const { timeline } = app;
  const el = document.createElement('div');
  el.className = 'oav-perf';
  el.innerHTML = `<div class="count"></div><div class="clockline"></div><div class="now"></div><div class="note"></div>
    <div class="acts"></div><div class="hold" hidden>HOLD · press Space to continue</div><div class="next"></div><div class="warn" hidden></div>`;
  document.body.appendChild(el);
  const q = (s) => el.querySelector(s);
  const nowEl = q('.now'), noteEl = q('.note'), actsEl = q('.acts'), holdEl = q('.hold'), nextEl = q('.next'), warnEl = q('.warn'), clockEl = q('.clockline'), countEl = q('.count');
  let on = false, lastActs = '';
  el.addEventListener('click', () => api.toggle());

  const api = {
    toggle() { on = !on; el.classList.toggle('on', on); return on; },
    get active() { return on; },
    render() {
      if (!on) return;
      const i = timeline.sceneIndexAt();
      const sc = timeline.scenes[i];
      const nx = timeline.scenes[i + 1];
      nowEl.textContent = sc ? (sc.title || sc.id || '') : '';
      noteEl.textContent = sc?.note || '';
      const acts = Array.isArray(sc?.acts) ? sc.acts : sc?.acts ? [String(sc.acts)] : [];
      const key = acts.join('\n');
      if (key !== lastActs) { lastActs = key; actsEl.innerHTML = ''; for (const a of acts) { const d = document.createElement('div'); d.textContent = a; actsEl.appendChild(d); } }
      const holding = !!timeline.holding;
      holdEl.hidden = !holding;
      const remain = holding ? 0 : Math.max(0, timeline.sceneEnd(i) - timeline.t);
      nextEl.innerHTML = '';
      if (nx) {
        nextEl.append('next  ', Object.assign(document.createElement('b'), { textContent: nx.title || nx.id }), holding ? '  (when you release)' : `  in ${fmt(remain)}`);
      } else nextEl.textContent = 'next: (end)';
      clockEl.textContent = `${fmt(timeline.t)} / ${fmt(timeline.total)}${holding ? '' : ' · −' + fmt(remain) + ' in this scene'}`;
      countEl.textContent = app.score ? app.score.cut : '';
      const failed = app.director?.status().failed || [];
      warnEl.hidden = !failed.length;
      if (failed.length) warnEl.textContent = `⚠ switched off: ${failed.join(', ')} (R resets)`;
    },
  };
  return api;
}
