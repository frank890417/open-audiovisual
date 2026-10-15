// log sink — one stdout line per value ("ch value"). The default when no config is given.
export function create(cfg, ctx) {
  let n = 0;
  return {
    name: 'log',
    send(ch, v) { n++; ctx.print(`${ch} ${v}`); },
    status: () => ({ state: 'up', lines: n }),
    close() {},
  };
}
