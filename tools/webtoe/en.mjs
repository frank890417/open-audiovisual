// /webtoe/ strings, English. Shape must match zh.mjs key for key —
// tools/build-webtoe.mjs refuses to build otherwise. Strings may contain inline
// HTML (authored, trusted). Numbers, code and URLs live in page.mjs.
// Facts come from the WebToe README (github.com/frank890417/WebToe); keep them in step with it.

export default {
  meta: {
    title: 'WebToe · the engine half of the open-audiovisual stack',
    description: 'WebToe is a web-native, node-based dataflow engine for real-time visuals: patch operators in the browser, TouchDesigner-style, on WebGL2 or WebGPU, with zero runtime dependencies. It opens real TouchDesigner projects, and @openav/world-webtoe turns a WebToe patch into an open-audiovisual world.',
    ogDescription: 'WebToe is the engine, open-audiovisual is the show.',
    ld: 'A web-native, node-based dataflow engine and editor for real-time visuals, TouchDesigner-style, on WebGL2 and WebGPU with zero runtime dependencies. Imports TouchDesigner .toe and .tox projects.',
  },

  hero: {
    eyebrow: 'Sister project · the engine',
    sub: 'A node-based dataflow engine for real-time visuals, in the browser.',
    lede: 'Patch operators together the way you would in TouchDesigner: a ramp through a transform into a composite, an LFO driving a parameter through an expression, a live preview on every node. WebToe is an original engine, built from scratch for the web on WebGL2 and WebGPU, and it opens your existing TouchDesigner projects.',
    tagline: '<strong>WebToe is the engine, open-audiovisual is the show.</strong> A WebToe patch can be performed as an open-audiovisual world, and named signals map naturally onto CHOP channels.',
    doorsLabel: 'Open WebToe',
    doors: [
      { who: 'Open', what: 'The editor, live in your browser, nothing to install' },
      { who: 'Read', what: 'The WebToe docs' },
      { who: 'Source', what: 'frank890417/WebToe on GitHub, MIT' },
      { who: 'Try', what: 'A raw 2022 .toe file, decoded in the browser' },
    ],
    shotAlt: 'The WebToe editor running the lfo garden example: three ramp and transform chains wired into composite, hsv adjust and out, a live preview on every node, the output in the viewer.',
    shotCaption: 'Example 03, lfo garden: three ramp chains rotated by LFOs through expressions, composited and hue-shifted. Every node previews live.',
  },

  engine: {
    eyebrow: '01 · The engine',
    title: 'Patch it live, in a browser tab',
    lede: 'A network editor, a real-time GPU engine, and a parameter panel where any value can be an expression. No install, no build step.',
    stats: [
      'of JavaScript for the whole app, with zero runtime dependencies',
      'two GPU backends at parity, behind one pass contract',
      'of 28,698 nodes from 60 real TouchDesigner projects are runnable: the measured corpus coverage',
      'bundled projects that run out of the box, two of them raw .toe files saved by TouchDesigner in 2022',
    ],
    statsSource: 'Numbers from the WebToe README, measured on real projects.',
    points: [
      { head: 'Patch live.', text: 'Press Tab to create an operator, drag wires, step into containers. Every node shows a real-time preview, and one GPU compositor paints them all at full frame rate.' },
      { head: 'Expressions anywhere.', text: 'Any parameter can be an expression: <code>op(\'lfo1\')[\'chan1\']</code>, <code>parent().par.speed</code>, <code>time.seconds * 0.2</code>.' },
      { head: 'A real-time GPU engine.', text: 'A pull-based cook loop. TOPs run as GPU passes and CHOPs drive parameters: feedback, blur, compositing, displacement, edge detection, webcam and video input, and a 3D pipeline with geometry, cameras, lights and a render TOP.' },
      { head: 'Six operator families.', text: 'TOP, CHOP, SOP, MAT, COMP and DAT. Projects save losslessly as <code>.webtoe.json</code>, a versioned format of its own.' },
    ],
    shotAlt: 'Example 02, feedback trails, in the WebToe editor: rectangle, transform, composite, blur and out operators, with a feedback and level loop wired back into the composite.',
    shotCaption: 'Example 02, feedback trails. Move the mouse over the viewer and the rectangle leaves a trail through the feedback loop.',
  },

  stack: {
    eyebrow: '02 · With open-audiovisual',
    title: 'WebToe is the engine, open-audiovisual is the show',
    lede: 'open-audiovisual brings the inputs, the mapping, the timeline and the backstage. WebToe draws. The adapter <code>@openav/world-webtoe</code> turns a WebToe patch into a world, so a knob, a chord or a hand can play it.',
    steps: [
      { name: 'Signal', text: 'Something happens on stage: a key is struck, a knob turns. It arrives as a named signal.' },
      { name: 'Param', text: 'The mapper routes the signal to a param of the world, with a curve and smoothing. The timeline can drive the same param.' },
      { name: 'Message', text: 'The world embeds the WebToe app in an iframe. Whenever a param moves, it posts the new values into it.' },
      { name: 'Patch', text: 'Inside the patch, every parameter written with <code>ext()</code> follows. The second number is the fallback while nothing is connected.' },
    ],
    showTitle: 'The show: a world that is a WebToe patch',
    showText: 'Example 04, shortened. The param keys are the names the patch listens for. The project file is handed to the app as <code>?project=</code>.',
    patchTitle: 'The patch: parameters that listen',
    patchText: 'Two expressions from the example’s <code>garden.webtoe.json</code>. Put <code>ext()</code> into any parameter and it becomes playable.',
    messageTitle: 'Drive it from any page',
    messageText: 'These are plain <code>postMessage</code> calls, so any page that embeds WebToe can drive it. Values must be finite numbers. <code>webtoe:load</code> opens another project without reloading the frame.',
    links: { example: 'Open example 04, WebToe stage', source: 'Source of @openav/world-webtoe', docs: 'The adapter in the handbook' },
  },

  import: {
    eyebrow: '03 · TouchDesigner projects',
    title: 'Drop a .toe and it opens',
    lede: 'No install and no command-line step: WebToe decodes the TouchDesigner container right in the browser. Supported operators run live. Everything else becomes a stub that keeps its name, wires, layout, parameters and Python code, and an import report says what happened.',
    factsTitle: 'Validated against toeexpand',
    facts: [
      'production project files, 3 KB to 151 MB, decoded to identical file sets, byte for byte (553,230 files)',
      'to decode all 125 natively, against 266.5 s for TouchDesigner’s own <code>toeexpand</code>',
      'for a 151 MB show file. A daily sketch takes a few milliseconds.',
      'from drop to a running graph for a real 20 MB show file of 14,710 nodes',
    ],
    tryLink: 'Try it with a raw 2022 project file',
    shotAlt: 'The TouchDesigner import report in WebToe after importing a 213-node production project: 71 nodes runnable, 142 kept as stubs, 9 expressions translated.',
    shotCaption: 'The import report for a 213-node production project: what runs, what was kept as a stub, which expressions were translated.',
    researchLabel: 'Research use only',
    research: '<strong>Native .toe decoding is provided for research purposes only.</strong> It exists to study interoperability with project files you own, is not affiliated with or endorsed by Derivative Inc., and may break with any TouchDesigner release. Derivative has announced an official JSON project format, and WebToe’s project loader is ready for it.',
    formatLink: 'Format notes and validation (TOE-FORMAT.md)',
    bridgeTitle: 'The reference path: your own TouchDesigner',
    bridgeText: 'If native decoding fails, WebToe falls back to the official <code>toeexpand</code> tool that ships with every TouchDesigner install, run on your machine through a small bridge. The bridge listens on 127.0.0.1 only and has zero dependencies. Your project files never leave your computer.',
  },

  legal: 'WebToe is an independent open-source project, not affiliated with or endorsed by Derivative Inc. TouchDesigner is a trademark of Derivative Inc. WebToe contains no Derivative code, binaries or assets.',
};
