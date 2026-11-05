// A QLC+ input profile (.qxi) as plain data. These files are flat and regular, so a few patterns read them with no XML library:
// the project has no dependencies, and a build step must not add one.
//
//   parseQxi(text) → { creator, manufacturer, model, type, sendNoteOff, channels, colors, midiChannels }
//   decodeQlcNumber(number) → { ch | null, msg, cc | note | value }
//
// Channel numbers (plugins/midi/src/common/midiprotocol.h in QLC+): CC 0–127, notes 128–255, note aftertouch 256–383, program change
// 384–511, channel aftertouch 512, pitch wheel 513. Above bit 12 sits the MIDI channel, for an input set to Omni.

const unesc = (s) => String(s).replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (m, n) => String.fromCodePoint(+n)).replace(/&amp;/g, '&');
const text = (src, tag) => { const m = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`).exec(src); return m ? unesc(m[1].trim()) : ''; };
const attrs = (s) => Object.fromEntries([...String(s).matchAll(/([A-Za-z]+)="([^"]*)"/g)].map((m) => [m[1], unesc(m[2])]));

export function parseQxi(xml) {
  const src = xml.replace(/<!--[\s\S]*?-->/g, '');
  if (!/<InputProfile[\s>]/.test(src)) throw new Error('not a QLC+ input profile');
  const creator = /<Creator>([\s\S]*?)<\/Creator>/.exec(src)?.[1] || '';
  const table = /<MidiChannelTable>([\s\S]*?)<\/MidiChannelTable>/.exec(src);
  const body = table ? src.replace(table[0], '') : src;
  const channels = [...body.matchAll(/<Channel\s+Number="(\d+)"\s*>([\s\S]*?)<\/Channel>/g)].map(([, number, c]) => {
    const fb = /<Feedback\b([^>]*?)\/?>/.exec(c), mv = /<Movement\b([^>]*?)(?:\/>|>([^<]*)<\/Movement>)/.exec(c);
    const f = fb ? attrs(fb[1]) : null, m = mv ? attrs(mv[1]) : null;
    return {
      number: +number, name: text(c, 'Name'), type: text(c, 'Type'),
      ...(m ? { movement: { sensitivity: +m.Sensitivity, relative: (mv[2] || '').trim() === 'Relative' } } : {}),
      ...(f ? { feedback: { lower: +(f.LowerValue ?? 0), upper: +(f.UpperValue ?? 255), ...(f.MidiChannel !== undefined ? { midiChannel: +f.MidiChannel } : {}) } } : {}),
      ...(/<ExtraPress>/.test(c) ? { extraPress: true } : {}),
    };
  });
  return {
    creator: { name: text(creator, 'Name'), version: text(creator, 'Version'), author: text(creator, 'Author') },
    manufacturer: text(src, 'Manufacturer'), model: text(src, 'Model'), type: text(src.replace(/<Channel[\s\S]*/, ''), 'Type'),
    sendNoteOff: /<MIDISendNoteOff>False</.test(src) ? false : true,
    channels,
    colors: [...src.matchAll(/<Color\s+([^>]*?)\/>/g)].map((m) => attrs(m[1])).map((c) => ({ value: +c.Value, label: c.Label, rgb: c.RGB })),
    midiChannels: table ? [...table[1].matchAll(/<Channel\s+([^>]*?)\/>/g)].map((m) => attrs(m[1])).map((c) => ({ value: +c.Value, label: c.Label })) : [],
  };
}

/** What MIDI message a QLC+ channel number means. `ch` is null when the number carries no channel (it then follows the input's setting). */
export function decodeQlcNumber(number) {
  const ch = number >> 12, n = number & 0xfff, base = ch ? { ch: ch + 1 } : { ch: null };
  if (n < 128) return { ...base, msg: 'cc', cc: n };
  if (n < 256) return { ...base, msg: 'note', note: n - 128 };
  if (n < 384) return { ...base, msg: 'polyat', note: n - 256 };
  if (n < 512) return { ...base, msg: 'program', value: n - 384 };
  if (n === 512) return { ...base, msg: 'chanat' };
  if (n === 513) return { ...base, msg: 'pitchbend' };
  return { ...base, msg: 'other', number: n };
}
