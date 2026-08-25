// @openav/world-webtoe — perform a WebToe patch as an openav World.
//
// WebToe (https://webtoe.openaudiovisual.com · github.com/frank890417/WebToe)
// is the sister project: a web-native, node-based dataflow engine that speaks
// TouchDesigner. This adapter embeds the WebToe app in an iframe and streams
// resolved openav params into it every frame via postMessage; inside the patch,
// any parameter written as  ext('name', fallback)  listens.
//
//   stage.register(webtoeWorld({
//     project: new URL('./garden.webtoe.json', import.meta.url).href,
//     params: [
//       { key: 'speed', min: 0, max: 1, def: 0.5 },
//       { key: 'hue',   min: 0, max: 360, def: 205 },
//     ],
//   }));
//
// The contract stays pure: the World reads params, never inputs. Which knob,
// hand, or timeline drives 'speed' is the mapper's business — same as any World.

export function webtoeWorld({
  name = 'webtoe',
  app = 'https://webtoe.openaudiovisual.com/',
  project = null,          // URL of a .webtoe.json (CORS must allow the app origin)
  params = [],             // openav param schema; keys are the ext() names in the patch
  extra = null,            // (state, out) => void — derive additional ext values per frame
} = {}) {
  return {
    name,
    params,
    init({ container }) {
      this.frame = document.createElement('iframe');
      const src = new URL(app);
      if (project) src.searchParams.set('project', project);
      this.frame.src = src.href;
      this.frame.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;border:0;background:#000;';
      this.frame.allow = 'camera; microphone';
      container.appendChild(this.frame);
      this._last = {};
    },
    update(dt, state) {
      const win = this.frame?.contentWindow;
      if (!win) return;
      const values = { ...state };
      if (extra) extra(state, values);
      // send only when something moved — patches cook regardless, no need to spam
      let changed = false;
      for (const k of Object.keys(values)) if (values[k] !== this._last[k]) { changed = true; break; }
      if (!changed) return;
      this._last = values;
      try { win.postMessage({ type: 'webtoe:ext', values }, '*'); } catch (e) {}
    },
    render() { /* the iframe paints itself */ },
    dispose() { this.frame?.remove(); this.frame = null; },
  };
}
