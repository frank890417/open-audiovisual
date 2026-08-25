// Layers panel — "what is every layer doing RIGHT NOW".
//
// During a performance the operator needs, at a glance: is input arriving,
// are routes firing, is the world alive, what is leaving the browser. One
// collapsible section per the universal panel convention:
//
//   L1 INPUT   events/s per signal namespace (midi · chord · audio · pose · …)
//   L2 MAPPING active routes + fires/s
//   L3 WORLD   active world name + fps
//   L4 OUTPUT  the per-channel MIDI OUT meter (lineage: The Last Input's
//              on-stage panel) · osc rate · sound engine state
//
// The MIDI meter hooks midi.onSend — the single throat every outgoing byte
// passes through — so this shows exactly what the DAW receives.

import { MidiMeter } from './midi-meter.js?v=0c76e80';

export function buildLayersPanel(root, app) {
  const { signals, mapper, stage, midi } = app;   // osc/sound/loop are read per-frame (late-bound)
  const panel = document.createElement('div');
  panel.className = 'oav-panel';
  panel.innerHTML = `<h3>Layers</h3>
    <div class="oav-layers">
      <div class="lay"><b class="l1">L1 input</b><span class="v" data-l1></span></div>
      <div class="lay"><b class="l2">L2 mapping</b><span class="v" data-l2></span></div>
      <div class="lay"><b class="l3">L3 world</b><span class="v" data-l3></span></div>
      <div class="lay"><b class="l4">L4 output</b><span class="v" data-l4></span></div>
    </div>
    <canvas class="oav-midimeter" height="150"></canvas>`;
  root.appendChild(panel);

  // --- L1: events/s per top-level namespace ---
  const nsCount = new Map();
  let nsRate = new Map();
  signals.onAny((name) => {
    const ns = name.split('/')[0];
    nsCount.set(ns, (nsCount.get(ns) || 0) + 1);
  });

  // --- L4: MIDI OUT meter (only draws when there is out traffic) ---
  const canvas = panel.querySelector('canvas');
  const ctx = canvas.getContext('2d');
  const meter = new MidiMeter();
  let outSeen = false;
  if (midi) {
    const prev = midi.onSend;
    midi.onSend = (bytes) => { prev?.(bytes); outSeen = true; meter.ingest(bytes, performance.now() / 1000); };
  }

  let lastRateAt = 0;
  const el = {
    l1: panel.querySelector('[data-l1]'), l2: panel.querySelector('[data-l2]'),
    l3: panel.querySelector('[data-l3]'), l4: panel.querySelector('[data-l4]'),
  };

  return {
    meter,
    render() {
      const now = performance.now();
      if (now - lastRateAt >= 1000) {
        nsRate = new Map(nsCount); nsCount.clear(); lastRateAt = now;
      }
      const l1 = [...nsRate.entries()].filter(([, n]) => n > 0)
        .sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ${n}/s`).join(' · ');
      el.l1.textContent = l1 || 'quiet';
      if (mapper) {
        const on = mapper.routes.filter(r => r.enabled !== false).length;
        el.l2.textContent = `${on} route${on === 1 ? '' : 's'}${mapper.learnTarget ? ' · LEARN: ' + mapper.learnTarget : ''}`;
      } else el.l2.textContent = '—';
      el.l3.textContent = `${stage?.activeName || '—'} · ${app.loop?.fps ?? '–'} fps`;
      const outs = [];
      if (outSeen) outs.push(`midi ${meter.totalRate}/s`);
      if (app.osc?.enabled) outs.push(`osc ${app.osc.rate?.() ?? ''}/s`);
      if (app.sound?.enabled) outs.push('sound ♪');
      el.l4.textContent = outs.join(' · ') || 'screen only';
      // meter canvas: draw only when MIDI OUT exists; keep it collapsed otherwise
      const t = now / 1000;
      meter.decay(t);
      if (outSeen) {
        canvas.style.display = 'block';
        const w = canvas.clientWidth || canvas.parentElement.clientWidth - 16;
        if (canvas.width !== w) canvas.width = w;
        meter.render(ctx, canvas.width, canvas.height, t);
      } else canvas.style.display = 'none';
    },
  };
}
