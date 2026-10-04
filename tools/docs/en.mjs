// Docs page strings, English (/docs/). Shape must match zh.mjs key for key —
// tools/build-docs.mjs refuses to build otherwise. Top bar and footer strings
// come from the homepage tables (tools/home/en.mjs), so they are translated once.

export default {
  meta: {
    title: 'Documentation · open-audiovisual',
    description: 'The open-audiovisual handbook: quick start, core concepts, writing a world, inputs, mapping, show control, MIDI controllers, phones, every signal and every package, and how AI agents work with it.',
    ogDescription: 'One page, every chapter: how to build a live audiovisual show in the browser with open-audiovisual.',
  },
  ldLanguage: 'en',

  eyebrow: 'Documentation',
  title: 'The open-audiovisual handbook',
  lede: 'Everything you need to run, write and perform a show, on one page. Every API name, option and signal here is checked against the source; when they disagree, the code is right.',
  stats: '{chapters} chapters · {sections} sections · v{version}',
  sourceNote: 'Written in Markdown in <code>docs/</code>; this page is generated from it.',
  llmsNote: 'For language models: <a href="{llms}">/llms.txt</a> · <a href="{llmsFull}">/llms-full.txt</a>',

  tocTitle: 'On this page',
  tocLabel: 'Documentation contents',
  tocButton: 'Contents',
  tocClose: 'Close contents',
  chapterSource: 'Source',
  editOnGitHub: 'Edit on GitHub',
  backToTop: 'Back to top',

  copy: 'Copy',
  copied: 'Copied',
  linkCopied: 'Link copied',
  anchorLabel: 'Link to this section',
  alerts: { note: 'Note', tip: 'Tip', important: 'Important', warning: 'Warning', caution: 'Caution', done: 'done', open: 'not done yet' },

  untranslated: 'This chapter has not been translated yet; the English text follows.',
  placeholder: {
    controllers: `# MIDI controllers & embedding

> [!NOTE]
> This chapter is being written. Until it lands, see the
> [controllers page](https://openaudiovisual.com/controllers/), the example
> [09-midi-controllers](../examples/09-midi-controllers/main.js), and the source in
> [packages/midi](../packages/midi/).
`,
  },
};
