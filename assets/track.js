// assets/track.js — a few things visitors do on openaudiovisual.com's own pages, counted as GA4 events.
//
// The site's <head> (tools/site/chrome.mjs, headBasics) loads it with `defer` on the generated pages, and nothing else
// does: p5/oav-p5.js, packages/ and embed/ never load it, so a page someone else builds with the framework counts nothing
// new (tests/track.test.js holds that). It does nothing at all unless window.gtag exists, and the site defines gtag only
// on openaudiovisual.com itself (GA_SNIPPET in chrome.mjs): on localhost, in a fork or in an embed nothing is sent.
//
// The events, each its own GA4 event name so it is counted without registering a custom dimension, each with at most
// three short params. Every param goes through clean(): lower case, [a-z0-9_.-] only, 40 characters at most, so no
// address, no query string and nothing a person typed can be in one. Listed in docs/controllers.md, "The site's own pages".
//   oav_copy             kind (loader | code | import_map | other), page_type
//   oav_outbound         kind (github | vendor | work | course | openprocessing | other), host, page_type
//   oav_controller_play  controller, page_type        once per page view: the first move on an on-screen controller
//   oav_export_download  format (qlc | mixxx | json), controller (the id of the controller, fixture or device), page_type
//   oav_example_start    example                       once per page view: the first click or key inside an example
//   oav_next_step        from (the page_type), to (p5 | example | docs | reference | …)
//   oav_search           page_type                     once per page view: the first input in a search box, never its text
//   oav_lang_switch      page_type, to (en | zh)
//
// The hooks are declarative: the generators write data-oav-event="…" (with data-oav-to, -format, -id, -link, -copy) on
// the elements, the chrome writes <meta name="oav-page-type" content="…" data-oav-id="…">, and one listener per kind of
// DOM event reads them. The first half of this file is pure, plain data in and { name, params } out: tests/track.test.js
// runs it in Node. Listeners are on the capture phase, so a canvas or a shadow root that stops an event does not hide it.
(function () {
  'use strict';

  var PAGE_TYPES = ['home', 'controller', 'controllers_index', 'verify', 'example', 'examples_index', 'docs', 'reference',
    'cheatsheet', 'p5', 'made_with', 'changelog', 'webtoe', 'check', 'not_found', 'devices_index', 'fixture', 'device'];
  /** event (without the oav_ prefix) → the params it may carry, in order */
  var SPEC = {
    copy: ['kind', 'page_type'],
    outbound: ['kind', 'host', 'page_type'],
    controller_play: ['controller', 'page_type'],
    export_download: ['format', 'controller', 'page_type'],
    example_start: ['example'],
    next_step: ['from', 'to'],
    search: ['page_type'],
    lang_switch: ['page_type', 'to'],
  };
  var ONCE = ['controller_play', 'example_start', 'search'];
  var COPY_KINDS = ['loader', 'code', 'import_map', 'other'];
  var OUT_KINDS = ['github', 'vendor', 'work', 'course', 'openprocessing', 'other'];
  var NEXT_TO = ['p5', 'example', 'examples', 'docs', 'reference', 'cheatsheet', 'controllers', 'made_with', 'changelog', 'home'];
  var FORMATS = ['qlc', 'mixxx', 'json'];
  var LANGS = ['en', 'zh'];
  var OWN = /(^|\.)openaudiovisual\.com$/;

  /** Any value → a short token: lower case, a-z 0-9 _ . - only, at most 40 characters. */
  function clean(v) {
    return String(v == null ? '' : v).toLowerCase().replace(/[^a-z0-9_.-]+/g, '').slice(0, 40);
  }
  function pick(v, list, otherwise) {
    var x = clean(v);
    return list.indexOf(x) >= 0 ? x : otherwise;
  }

  /** { name: 'oav_…', params } with only the params SPEC allows for it, each cleaned; null for an unknown event. */
  function event(name, raw) {
    var keys = SPEC[name];
    if (!keys) return null;
    var params = {};
    for (var i = 0; i < keys.length; i++) {
      var v = clean(raw && raw[keys[i]]);
      if (v) params[keys[i]] = v;
    }
    return { name: 'oav_' + name, params: params };
  }

  /** What was copied: the generator's word for it, or what the code itself is. The text is read here and never sent. */
  function copyKind(declared, text) {
    var d = pick(declared, COPY_KINDS, '');
    if (d) return d;
    var s = String(text || '');
    if (/\/p5\/oav-p5\.js/.test(s)) return 'loader';
    if (/"imports"\s*:|type="importmap"/.test(s)) return 'import_map';
    return s.trim() ? 'code' : 'other';
  }

  /** The host name of an http(s) address, '' for anything else. Only this part of a link is ever sent. */
  function hostOf(href) {
    try {
      var u = new URL(String(href));
      return u.protocol === 'https:' || u.protocol === 'http:' ? u.hostname.toLowerCase() : '';
    } catch (e) { return ''; }
  }

  function outKind(declared, host) {
    var d = pick(declared, OUT_KINDS, '');
    if (d) return d;
    if (host === 'github.com' || /\.github\.com$|\.githubusercontent\.com$/.test(host)) return 'github';
    if (host === 'openprocessing.org' || /\.openprocessing\.org$/.test(host)) return 'openprocessing';
    return 'other';
  }

  /**
   * A click, as plain data, → the event it means, or null.
   *   pageType, pageId      from the page's <meta name="oav-page-type">
   *   here                  location.hostname
   *   copyButton, copy, text   a copy button was pressed; its data-oav-copy; the code it copies (classified, never sent)
   *   event, to, format, id, lang, current   the data-oav-* of the nearest element that has data-oav-event
   *   href, link            the link that was followed (absolute) and its data-oav-link
   */
  function fromClick(d) {
    d = d || {};
    var pt = d.pageType;
    if (d.copyButton) return event('copy', { kind: copyKind(d.copy, d.text), page_type: pt });
    if (d.event === 'export_download') return event('export_download', { format: pick(d.format, FORMATS, 'other'), controller: d.id || d.pageId, page_type: pt });
    if (d.event === 'next_step') return d.to ? event('next_step', { from: pt, to: pick(d.to, NEXT_TO, 'other') }) : null;
    if (d.event === 'lang_switch') return d.lang && !d.current ? event('lang_switch', { page_type: pt, to: pick(d.lang, LANGS, 'other') }) : null;
    var host = d.href ? hostOf(d.href) : '';
    if (host && host !== String(d.here || '').toLowerCase() && !OWN.test(host)) return event('outbound', { kind: outKind(d.link, host), host: host, page_type: pt });
    return null;
  }
  /** A `control` event of an <oav-controller>: only one the page marked, only a move made on the screen. */
  function fromControl(d) {
    return d && d.hooked && d.source === 'ui' ? event('controller_play', { controller: d.profile, page_type: d.pageType }) : null;
  }
  /** An `input` event: only that it happened in a search box. */
  function fromInput(d) {
    return d && d.search ? event('search', { page_type: d.pageType }) : null;
  }
  /** A pointer or key on an example page, outside its guide card. */
  function fromInteract(d) {
    return d && d.pageType === 'example' && !d.inGuide ? event('example_start', { example: d.pageId }) : null;
  }
  /** ⌘C / Ctrl+C: counted only when the selection is in a code block. */
  function fromNativeCopy(d) {
    return d && d.inCode ? event('copy', { kind: copyKind('', d.text), page_type: d.pageType }) : null;
  }

  var api = { PAGE_TYPES: PAGE_TYPES, SPEC: SPEC, ONCE: ONCE, COPY_KINDS: COPY_KINDS, OUT_KINDS: OUT_KINDS, NEXT_TO: NEXT_TO, FORMATS: FORMATS,
    clean: clean, event: event, copyKind: copyKind, hostOf: hostOf, outKind: outKind,
    fromClick: fromClick, fromControl: fromControl, fromInput: fromInput, fromInteract: fromInteract, fromNativeCopy: fromNativeCopy };
  // tests/track.test.js runs this file in a sandbox that has this one object, and no window
  if (typeof __OAV_TRACK_TEST__ === 'object' && __OAV_TRACK_TEST__) { for (var k in api) __OAV_TRACK_TEST__[k] = api[k]; return; }

  // ---------------------------------------------------------------- the page: nothing without gtag
  if (typeof window === 'undefined' || typeof document === 'undefined' || typeof window.gtag !== 'function') return;

  var meta = document.querySelector('meta[name="oav-page-type"]');
  var pageType = meta ? meta.getAttribute('content') || '' : '';
  var pageId = meta ? meta.getAttribute('data-oav-id') || '' : '';
  var sent = {}, lastCopy = 0;

  function send(ev) {
    if (!ev) return;
    var key = ev.name.slice(4);
    if (ONCE.indexOf(key) >= 0) { if (sent[key]) return; sent[key] = true; }
    if (key === 'copy') { var now = Date.now(); if (now - lastCopy < 1000) return; lastCopy = now; }   // a button's fallback can also fire a copy event
    try { window.gtag('event', ev.name, ev.params); } catch (e) { /* analytics never breaks the page */ }
  }

  var COPY_BUTTONS = 'button.copy, .ref-copy, .ref-loader-copy, [data-oav-copy]';
  function codeOf(btn) {
    var id = btn.getAttribute('data-copy'), el = id ? document.getElementById(id) : null;
    if (!el) { var box = btn.closest('.term, figure, .ref-loader'); el = box ? box.querySelector('pre') : null; }
    return el ? el.textContent : '';
  }
  var get = function (el, name) { return el ? el.getAttribute(name) || '' : ''; };

  function onClick(e) {
    if (e.type === 'auxclick' && e.button !== 1) return;   // a middle click opens a link too
    var t = e.target;
    if (!t || !t.closest) return;
    var btn = t.closest(COPY_BUTTONS), h = t.closest('[data-oav-event]'), a = t.closest('a[href]');
    send(fromClick({
      pageType: pageType, pageId: pageId, here: location.hostname,
      copyButton: !!btn, copy: get(btn, 'data-oav-copy'), text: btn ? codeOf(btn) : '',
      event: get(h, 'data-oav-event'), to: get(h, 'data-oav-to'), format: get(h, 'data-oav-format'), id: get(h, 'data-oav-id'),
      lang: get(h, 'data-lang') || get(h, 'data-set'), current: !!h && (get(h, 'aria-current') === 'page' || get(h, 'aria-pressed') === 'true'),
      href: a ? a.href : '', link: get(a, 'data-oav-link'),
    }));
  }
  document.addEventListener('click', onClick, true);
  document.addEventListener('auxclick', onClick, true);

  document.addEventListener('copy', function () {
    var s = window.getSelection ? window.getSelection() : null;
    if (!s || !s.rangeCount) return;
    var n = s.anchorNode, el = n && (n.nodeType === 1 ? n : n.parentElement);
    send(fromNativeCopy({ inCode: !!(el && el.closest && el.closest('pre, code')), text: String(s), pageType: pageType }));
  }, true);

  // <oav-controller>'s `control` bubbles out of its shadow root; at the document its target is the element itself
  document.addEventListener('control', function (e) {
    var el = e.target, d = e.detail || {};
    send(fromControl({ hooked: !!(el && el.closest && el.closest('[data-oav-event="controller_play"]')), source: d.source, profile: d.profile, pageType: pageType }));
  }, true);

  document.addEventListener('input', function (e) {
    var t = e.target;
    send(fromInput({ search: !!(t && t.matches && t.matches('input[type="search"]')), pageType: pageType }));
  }, true);

  if (pageType === 'example') {
    var start = function (e) {
      var t = e.target;
      send(fromInteract({ pageType: pageType, pageId: pageId, inGuide: !!(t && t.closest && t.closest('#oav-guide, .oav-next')) }));
    };
    window.addEventListener('pointerdown', start, true);
    window.addEventListener('keydown', start, true);
  }
})();
