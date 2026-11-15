// @openav/core · signature — how a page says "this runs on open-audiovisual" without sending anything.
//
// sign() adds one tag to the page's <head>:
//     <meta name="generator" content="open-audiovisual 0.9.0">
// the same tag WordPress, Hugo and p5's editor leave. Nothing leaves the browser: no request, no cookie, no id.
// It is there so a person reading the source, a search of the public web or a web census can tell what a show
// is built on; that is how the project learns which works use it (docs/introduction.md, "What a page tells the world").
// createShow() calls it; createShow({ signature: false }) leaves the page untouched.

/** The version of the framework: the one in package.json, and the tag a pinned URL names (v0.9.0). */
export const VERSION = '0.9.0';

/**
 * Mark a document as made with open-audiovisual. Returns the <meta> element, or null where there is no document
 * (Node, a worker). Calling it again changes nothing: one tag per product.
 * @param {Document} [doc]
 * @param {{ product?: string, version?: string }} [what]  another product of the project (oav-p5 signs as "oav-p5 0.8.6 (open-audiovisual)")
 */
export function sign(doc = globalThis.document, { product = 'open-audiovisual', version = VERSION } = {}) {
  if (!doc || !doc.head || typeof doc.createElement !== 'function') return null;
  const mine = [...doc.head.querySelectorAll('meta[name="generator"]')]
    .find((m) => (m.getAttribute('content') || '').startsWith(product + ' '));
  if (mine) return mine;
  const meta = doc.createElement('meta');
  meta.setAttribute('name', 'generator');
  meta.setAttribute('content', `${product} ${version}`);
  doc.head.appendChild(meta);
  return meta;
}
