// mountSoundPicker · the instrument chooser the console and the homepage share.
//
// A native <select> with one optgroup per category: keyboard-accessible, works on
// a phone, needs no styling to be usable. Picking an instrument is a click, which
// is also the gesture a browser needs before it plays audio, so picking turns
// sound on when it is still off. Shows loading progress for samplers and the
// credit line an instrument asks for (the Salamander piano is CC-BY: always shown).
//
//   const picker = mountSoundPicker(el, sound, { lang: 'zh' });   // className for your own styling

import { getInstrument, instrumentGroups, instrumentName, onInstrumentsChange } from './registry.js?v=0cfcfd4';

const TEXT = {
  en: { label: 'instrument', loading: 'loading {name}… {pct}%', failed: 'could not load {name}', fallback: 'could not load {name}; playing {other} instead' },
  zh: { label: '樂器', loading: '正在載入{name}… {pct}%', failed: '{name}載入失敗', fallback: '{name}載入失敗，先用{other}代替' },
};

export function mountSoundPicker(container, sound, {
  lang = (globalThis.document?.documentElement?.lang || 'en').toLowerCase().startsWith('zh') ? 'zh' : 'en',
  className = 'oav-sound-pick', label = null, enableOnPick = true,
} = {}) {
  const t = TEXT[lang] || TEXT.en;
  const fmt = (s, o) => s.replace(/\{(\w+)\}/g, (_, k) => o[k] ?? '');
  const el = document.createElement('div');
  el.className = className;
  const row = document.createElement('label');
  row.className = className + '-row';
  const lbl = document.createElement('span');
  lbl.className = className + '-label';
  lbl.textContent = label ?? t.label;
  const select = document.createElement('select');
  row.append(lbl, select);
  const st = document.createElement('div');
  st.className = className + '-status';
  st.setAttribute('aria-live', 'polite');
  const meter = document.createElement('span');
  meter.className = className + '-meter';
  const fill = document.createElement('i');
  meter.appendChild(fill);
  const txt = document.createElement('span');
  st.append(meter, txt);
  st.hidden = true;
  const credit = document.createElement('div');
  credit.className = className + '-credit';
  el.append(row, st, credit);
  container.appendChild(el);

  const name = (id) => instrumentName(getInstrument(id), lang) || id;
  const options = () => {
    const keep = sound.instrument;
    select.textContent = '';
    for (const g of instrumentGroups(lang)) {
      const og = document.createElement('optgroup');
      og.label = g.label;
      for (const d of g.items) og.appendChild(new Option(instrumentName(d, lang), d.id));
      select.appendChild(og);
    }
    if (keep) select.value = keep;
  };
  const showCredit = (id) => {
    credit.textContent = '';
    const c = getInstrument(id)?.credit;
    if (!c) { credit.hidden = true; return; }
    credit.hidden = false;
    const text = typeof c === 'string' ? c : c.text;
    if (typeof c === 'object' && /^https?:\/\//.test(c.url || '')) {
      const a = document.createElement('a');
      a.href = c.url; a.target = '_blank'; a.rel = 'noopener'; a.textContent = text;
      credit.appendChild(a);
    } else credit.textContent = text;
  };
  const status = (msg, progress = null) => {
    st.hidden = !msg;
    txt.textContent = msg || '';
    meter.hidden = progress == null;
    if (progress != null) fill.style.width = Math.round(progress * 100) + '%';
  };

  let notice = null;                      // a fallback message stays until the next pick
  select.addEventListener('change', () => {
    const id = select.value;
    notice = null;
    showCredit(id);
    sound.setInstrument(id, { remember: true }).catch((e) => console.error('[sound]', e));
    if (enableOnPick && !sound.enabled) sound.enable().catch((e) => { status(String(e.message || e)); console.error('[sound]', e); });
  });

  const off = [
    sound.onChange((ev) => {
      if (ev.type === 'loading') status(fmt(t.loading, { name: name(ev.id), pct: Math.round((ev.progress || 0) * 100) }), ev.progress || 0);
      else if (ev.type === 'instrument' || ev.type === 'ready') {
        if (select.value !== ev.id) select.value = ev.id;
        showCredit(ev.id);
        if (sound.status.state !== 'loading') status(notice || '');
      } else if (ev.type === 'error') {
        notice = fmt(ev.fallback ? t.fallback : t.failed, { name: name(ev.id), other: name(ev.fallback) });
        status(notice);
      }
    }),
    onInstrumentsChange(() => options()),
  ];
  options();
  showCredit(sound.instrument);
  const s = sound.status;
  if (s.state === 'loading') status(fmt(t.loading, { name: name(s.id), pct: Math.round(s.progress * 100) }), s.progress);

  return {
    el, select,
    refresh: options,
    dispose() { off.forEach((u) => u()); el.remove(); },
  };
}
