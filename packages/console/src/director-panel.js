// Director panel — the score's desk. Only mounted when the show has a score.
//   · which cut is playing (a picker: choosing another reloads the page with ?cut=<id>)
//   · the current segment: title, how far through it, seconds left
//   · HOLD: the show is waiting for you (Space or → to continue)
//   · the next segment and the countdown to it
//   · ACTS: what the operator does in this segment
//   · this segment's cues, ticked as they pass
//   · a red warning naming any segment module that crashed and was switched off (R brings it back)
// The scrubber above it (transport) draws the segment blocks and the cue ticks.
const fmt = (t) => { t = Math.max(0, t); return Math.floor(t / 60) + ':' + String(Math.floor(t % 60)).padStart(2, '0'); };

export function buildDirectorPanel(root, app) {
  const { director, score, timeline } = app;
  const panel = document.createElement('div');
  panel.className = 'oav-panel oav-director';
  panel.innerHTML = `<h3>Director · score</h3>
    <div class="dir-cut"><span>cut</span><select></select></div>
    <div class="dir-now"><b></b><span></span></div>
    <div class="dir-bar"><i></i></div>
    <div class="dir-hold" hidden>HOLD · waiting for you. Space or → continues</div>
    <div class="dir-next"><b></b><span></span></div>
    <div class="dir-acts"><h4>You do</h4><ul></ul></div>
    <div class="dir-cuesbox"><h4>Cues</h4><div class="dir-cues"></div></div>
    <div class="dir-warn" hidden></div>`;
  root.appendChild(panel);
  const q = (s) => panel.querySelector(s);
  const sel = q('.dir-cut select');
  const titleEl = q('.dir-now b'), clkEl = q('.dir-now span'), barEl = q('.dir-bar i'), holdEl = q('.dir-hold');
  const nextB = q('.dir-next b'), nextS = q('.dir-next span'), actsBox = q('.dir-acts'), actsEl = q('.dir-acts ul');
  const cuesBox = q('.dir-cuesbox'), cuesEl = q('.dir-cues'), warnEl = q('.dir-warn');

  // cut picker: a different cut is a different show structure, so it is a fresh page (?cut=<id>), nothing half-switched
  const cuts = score.cuts;
  if (cuts.length > 1) {
    for (const c of cuts) sel.append(Object.assign(document.createElement('option'), { value: c.id, textContent: `${c.title} · ${fmt(c.total)}`, selected: c.id === score.cut }));
    sel.addEventListener('change', () => {
      const u = new URL(location.href); u.searchParams.set('cut', sel.value);
      location.href = u.toString();
    });
  } else q('.dir-cut').remove();

  const last = {};
  const set = (el, key, text) => { if (last[key] !== text) { last[key] = text; el.textContent = text; } };
  let cueFor = -1, cueEls = [];

  return {
    render() {
      const st = director.status();
      const s = st.segment;
      set(titleEl, 'title', `${s.title}${s.hold ? '  ⏸' : ''}`);
      set(clkEl, 'clk', st.holding ? 'holding' : `${fmt(s.t)} / ${fmt(s.dur)}  −${fmt(s.remaining)}`);
      barEl.style.width = (Math.min(1, s.p) * 100).toFixed(1) + '%';
      holdEl.hidden = !st.holding;
      set(nextB, 'nextb', st.next ? st.next.title : '(end of the show)');
      set(nextS, 'nexts', st.next ? (st.holding ? 'on release' : 'in ' + fmt(st.next.in)) : '');
      const acts = s.acts.join('\n');
      if (last.acts !== acts) {
        last.acts = acts; actsEl.innerHTML = '';
        for (const a of s.acts) actsEl.append(Object.assign(document.createElement('li'), { textContent: a }));
        actsBox.hidden = !s.acts.length;
      }
      if (cueFor !== s.index) {
        cueFor = s.index; cuesEl.innerHTML = ''; cueEls = [];
        const seg = score.segments[s.index];
        for (const [name, c] of Object.entries(seg.cues).sort((a, b) => a[1].T - b[1].T)) {
          const b = Object.assign(document.createElement('button'), { className: 'oav-chip', textContent: name, title: `jump to ${seg.id}.${name} (${fmt(c.T)})` });
          b.addEventListener('click', () => timeline.seek(c.T, 'jump'));
          cuesEl.append(b); cueEls.push([b, c.T]);
        }
        cuesBox.hidden = !cueEls.length;
      }
      for (const [b, T] of cueEls) b.classList.toggle('passed', timeline.t >= T);
      const bad = st.failed.length || st.missing.length;
      warnEl.hidden = !bad;
      if (bad) {
        const lines = [];
        if (st.failed.length) lines.push(`⚠ switched off: ${st.failed.join(', ')} — the show goes on. R resets.`);
        for (const id of st.failed) lines.push(`${id}: ${st.errors[id]}`);
        if (st.missing.length) lines.push(`no module registered for: ${st.missing.join(', ')}`);
        const text = lines.join('\n');
        if (last.warn !== text) {
          last.warn = text; warnEl.innerHTML = '';
          warnEl.append(lines[0] || '');
          for (const l of lines.slice(1)) warnEl.append(Object.assign(document.createElement('small'), { textContent: l }));
        }
      } else last.warn = '';
    },
  };
}
