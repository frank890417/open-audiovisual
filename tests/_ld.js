// Shared by the page tests: every page carries ONE JSON-LD script, a @graph (tools/site/chrome.mjs jsonLdGraph).
export const ldGraph = (html) => JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1])['@graph'];
export const hasType = (n, t) => [].concat(n['@type']).includes(t);
export const ldNode = (html, t) => ldGraph(html).find((n) => hasType(n, t));
