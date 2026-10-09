// Transport: play/pause · scene jump · clock · timeline scrubber with scene blocks.
// Scenes that come from a score also draw their cues (a tick you can click) and, for a `hold`
// scene, a dashed end: the playhead will stop there and wait.
const fmt = (t) => {
  const neg = t < 0; t = Math.abs(t);
  return (neg ? '-' : '') + Math.floor(t / 60) + ':' + String(Math.floor(t % 60)).padStart(2, '0');
};

export function buildTransport(root, app) {
  const { timeline } = app;
  const bar = document.createElement('div');
  bar.className = 'oav-row';
  bar.innerHTML = `
    <button class="oav-btn" data-a="play">▶</button>
    <button class="oav-btn" data-a="prev">⏮</button>
    <button class="oav-btn" data-a="next">⏭</button>
    <button class="oav-btn" data-a="reset">↺</button>
    <span class="oav-clock">0:00</span>
    <span class="oav-scene"></span>
  `;
  root.appendChild(bar);

  const scrub = document.createElement('div');
  scrub.className = 'oav-scrub';
  root.appendChild(scrub);

  const lo = timeline.scenes.length ? Math.min(0, timeline.scenes[0].t) : 0;
  const span = timeline.total - lo;
  const toX = (t) => ((t - lo) / span) * 100;

  // scene blocks
  for (let i = 0; i < timeline.scenes.length; i++) {
    const sc = timeline.scenes[i];
    const el = document.createElement('div');
    el.className = 'blk';
    el.style.left = toX(sc.t) + '%';
    el.style.width = (toX(timeline.sceneEnd(i)) - toX(sc.t)) + '%';
    el.textContent = `${i}·${sc.title || sc.id || ''}${sc.hold ? ' ⏸' : ''}`;
    el.dataset.i = i;
    if (sc.hold) el.classList.add('hold');
    el.title = sc.title ? `${sc.title} — ${fmt(sc.t)}–${fmt(timeline.sceneEnd(i))}${sc.hold ? ' · holds at the end until released' : ''}` : '';
    scrub.appendChild(el);
    for (const c of sc.cues || []) {
      const tick = document.createElement('div');
      tick.className = 'cue';
      tick.style.left = toX(c.t) + '%';
      tick.title = `cue ${sc.id}.${c.name} — ${fmt(c.t)} (click to jump)`;
      tick.dataset.t = c.t;
      scrub.appendChild(tick);
    }
  }
  const head = document.createElement('div');
  head.className = 'head';
  scrub.appendChild(head);

  scrub.addEventListener('pointerdown', (e) => {
    if (e.target.classList?.contains('cue')) { timeline.seek(Number(e.target.dataset.t), 'jump'); return; }   // a cue tick jumps right onto the cue
    const seekFromEvent = (ev) => {
      const r = scrub.getBoundingClientRect();
      timeline.seek(lo + span * Math.min(1, Math.max(0, (ev.clientX - r.left) / r.width)));
    };
    seekFromEvent(e);
    const move = (ev) => seekFromEvent(ev);
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  });

  bar.addEventListener('click', (e) => {
    const a = e.target.dataset?.a;
    if (a === 'play') timeline.toggle();
    else if (a === 'prev') (timeline.prev ? timeline.prev() : timeline.jumpScene(-1));
    else if (a === 'next') (timeline.next ? timeline.next() : timeline.jumpScene(1));
    else if (a === 'reset') timeline.reset();
  });

  const clockEl = bar.querySelector('.oav-clock');
  const sceneEl = bar.querySelector('.oav-scene');
  const playBtn = bar.querySelector('[data-a=play]');

  return {
    render() {
      clockEl.textContent = fmt(timeline.t);
      const holding = !!timeline.holding;
      playBtn.textContent = timeline.playing ? '⏸' : '▶';
      playBtn.classList.toggle('active', timeline.playing);
      playBtn.classList.toggle('holding', holding);
      playBtn.title = holding ? 'holding — release to the next segment (Space)' : 'play / pause (Space)';
      head.style.left = toX(timeline.t) + '%';
      const i = timeline.sceneIndexAt();
      const sc = timeline.scenes[i];
      sceneEl.textContent = sc ? `#${i} ${sc.title || sc.id || ''}${holding ? ' · HOLD' : ''}` : '';
      scrub.querySelectorAll('.blk').forEach(el => el.classList.toggle('cur', Number(el.dataset.i) === i));
    },
  };
}
