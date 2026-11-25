// writes — which rule the writers of a show follow when several of them touch one value (docs/mapping.md#who-holds-a-value).
//
//   'hold'    (the default since 0.11.0) a value set by hand holds until it is released: nothing that only re-pushes
//             (a source re-sending the same reading, a smoothed route's tail, the per-frame push into the sound engine)
//             may undo it. Re-pushers write only when their own input changed.
//   'legacy'  exactly what 0.10.0 did: the sound engine is told every sound/* value every frame, a route takes its param
//             back on any reading after ✕ or a slider, a glide only notices a hand that wrote a different number.
//
// createShow({ writes }), new Mapper({ writes }) and new Sound({ writes }) read it through writesMode(). It is not a public
// export: the option is.

let warned = false;

/** 'hold' | 'legacy' from an option value (undefined and null are 'hold'); anything else throws, naming where it came from. */
export function writesMode(value, where = 'writes') {
  if (value === undefined || value === null || value === 'hold') return 'hold';
  if (value === 'legacy') {
    if (!warned) {
      warned = true;
      console.warn(`[openav] ${where}: 'legacy' brings back how 0.10.0 wrote params and sound: a value set by hand can be undone by a re-sent reading, a glide or the per-frame sound push. It is deprecated and will go in a later version: see "Who holds a value" in docs/mapping.md.`);
    }
    return 'legacy';
  }
  throw new TypeError(`${where} must be 'hold' (the default) or 'legacy' (got ${JSON.stringify(value) ?? String(value)})`);
}
