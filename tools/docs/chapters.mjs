// The docs handbook: chapter order, anchor ids, and the Markdown each chapter
// is rendered from. Markdown is the source of truth; /docs/ and /zh/docs/ are
// generated from it by tools/build-docs.mjs.
//
//   id        the chapter's anchor (/docs/#mapping); section anchors are derived
//             from the English headings (`mapping-curves`) and shared by zh
//   en / zh   Markdown sources, relative to the repo root
//   external  written by another workstream; when the file is missing the page
//             shows a short placeholder and picks the file up on the next build
//
// English chapters under docs/ also feed llms-full.txt (tools/build-home.mjs)
// and the MCP server's read_doc tool, so they must read well on their own.

export const CHAPTERS = [
  { id: 'introduction', en: 'docs/introduction.md', zh: 'docs/zh/introduction.md' },
  { id: 'quick-start', en: 'docs/getting-started.md', zh: 'docs/zh/getting-started.md' },
  { id: 'concepts', en: 'docs/concepts.md', zh: 'docs/zh/concepts.md' },
  { id: 'architecture', en: 'docs/architecture.md', zh: 'docs/zh/architecture.md' },
  { id: 'writing-a-world', en: 'docs/writing-a-world.md', zh: 'docs/zh/writing-a-world.md' },
  { id: 'inputs', en: 'docs/inputs.md', zh: 'docs/zh/inputs.md' },
  { id: 'mapping', en: 'docs/mapping.md', zh: 'docs/zh/mapping.md' },
  { id: 'show-control', en: 'docs/show-control.md', zh: 'docs/zh/show-control.md' },
  { id: 'score', en: 'docs/score.md', zh: 'docs/zh/score.md' },
  { id: 'controllers', en: 'docs/controllers.md', zh: 'docs/zh/controllers.md', external: true },
  { id: 'phones', en: 'docs/remote.md', zh: 'docs/zh/remote.md' },
  { id: 'signals', en: 'docs/signals.md', zh: 'docs/zh/signals.md' },
  { id: 'packages', en: 'docs/packages.md', zh: 'docs/zh/packages.md' },
  { id: 'agents', en: 'docs/agents.md', zh: 'docs/zh/agents.md' },
  { id: 'lab-integration', en: 'docs/lab-integration.md', zh: 'docs/zh/lab-integration.md' },
  { id: 'troubleshooting', en: 'docs/troubleshooting.md', zh: 'docs/zh/troubleshooting.md' },
  { id: 'roadmap', en: 'docs/roadmap.md', zh: 'docs/zh/roadmap.md' },
];
