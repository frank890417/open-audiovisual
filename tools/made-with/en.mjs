// /made-with/ strings, English. Shape must match zh.mjs key for key (tools/build-made-with.mjs refuses to build otherwise).
// The works themselves are data: made-with/works.json.

export default {
  meta: {
    title: 'Made with open-audiovisual · works, tools and classes that run on it',
    description: 'Performances, installations, tools and classes built on open-audiovisual, each added by the person who made it. How to add yours, the badge, and how a page says what it runs on without sending anything.',
    ogDescription: 'Works, tools and classes that run on open-audiovisual, and how to add yours.',
    crumb: 'Made with',
  },
  hero: {
    eyebrow: 'Made with',
    title: 'What runs on it',
    lede: 'Performances, installations, tools and classes built on open-audiovisual. Every entry is here because the person who made it added it. The list starts with the works the framework was taken out of.',
    count: { one: '{n} entry', many: '{n} entries' },
  },
  kinds: { performance: 'Performance', installation: 'Installation', sketch: 'Sketch', tool: 'Tool', teaching: 'Class', other: 'Work' },
  by: 'by',
  usesLabel: 'Uses',
  add: {
    title: 'Add yours',
    lede: 'A sketch on OpenProcessing with the one line in it counts. So does a show that uses a single package.',
    steps: [
      'Open the <a href="{issue}">“I made this” form</a> on GitHub and fill in the title, your name, a link and one or two sentences. We add the entry.',
      'Or edit <a href="{file}"><code>made-with/works.json</code></a> yourself and open a pull request: one object per work, the fields are the ones you see in the file.',
    ],
    note: 'An entry is a link and a few words. We host nothing of yours, and the work stays yours. Ask for a change or a removal the same way, at any time.',
  },
  badge: {
    title: 'The badge',
    lede: 'If you want your page to say so, paste this where your credits are:',
    alt: 'Built with open-audiovisual',
  },
  tell: {
    title: 'How a page says what it runs on',
    body: [
      'A show started with <code>createShow()</code> puts one tag in its page: <code>&lt;meta name="generator" content="open-audiovisual {version}"&gt;</code>. It is the same tag WordPress and Hugo leave. Nothing is sent anywhere: it is there for a person who views the source, and for searches and censuses of the public web. <code>createShow({ signature: false })</code> leaves it out.',
      'Separately, a show and an embedded controller send one anonymous hit that carries the address of the site they run on and nothing else, and <code>telemetry: false</code> switches it off. The one line for p5.js sends nothing unless you turn it on. <a href="{docs}">What is sent, what is never sent, and every off switch</a>.',
    ],
  },
  links: { examples: 'Examples', docs: 'Docs', controllers: 'Controller library' },
};
