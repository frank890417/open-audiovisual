// assets/send-bar.js — on a phone, one small bar: "Send this page to your computer".
//
// The framework is played in a desktop browser (Web MIDI, a keyboard, a big screen); a visitor who arrives on a phone (a link in a
// chat, a social post) can send the page on to the computer instead of leaving. The bar appears only when the screen is narrow AND
// the primary input is touch (both media queries), never on a desktop or a tablet in landscape. The button opens the phone's own
// share sheet (navigator.share: AirDrop, a message to yourself, mail) where there is one, and copies the link where there is not;
// if the clipboard is refused, the link is shown selected so a long press copies it. × hides it for the rest of the visit
// (sessionStorage only: nothing is kept after the tab closes, nothing is sent anywhere).
//
// tools/site/chrome.mjs (headBasics, sendBar) loads it with defer on the homepage, /p5/, the example pages, /controllers/ and every
// controller page, with the words in both languages on the script tag (data-strings, from the homepage tables, ui.send). The button carries
// data-oav-event="send_to_desktop" data-oav-method="share | copy", which assets/track.js counts as oav_send_to_desktop.
(function () {
  'use strict';
  var me = document.currentScript;
  var KEY = 'oav-send-dismissed';
  var WHEN = '(max-width: 760px) and (pointer: coarse)';
  if (!me || !window.matchMedia || !matchMedia(WHEN).matches) return;
  try { if (sessionStorage.getItem(KEY) === '1') return; } catch (e) { /* storage blocked: show it, it can still be closed */ }
  var all = {};
  try { all = JSON.parse(me.getAttribute('data-strings') || '{}'); } catch (e) { return; }

  function show() {
    var root = document.documentElement;
    // an example page is in English with a bilingual guide: the language the guide shows (data-ui) wins
    var lang = root.getAttribute('data-ui') || (/^zh/i.test(root.lang || '') ? 'zh' : 'en');
    var T = all[lang] || all.en;
    if (!T || document.querySelector('.oav-send')) return;
    var canShare = typeof navigator.share === 'function';
    var css = '.oav-send{position:fixed;left:8px;right:8px;bottom:calc(8px + env(safe-area-inset-bottom,0px));z-index:2147483000;display:flex;align-items:center;gap:8px;'
      + 'padding:6px 6px 6px 8px;background:#16171a;color:#edebe5;border:1px solid #3a3b40;border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,.45);'
      + 'font:500 14px/1.3 system-ui,-apple-system,sans-serif;box-sizing:border-box;max-width:calc(100vw - 16px)}'
      + '.oav-send-go{flex:1;min-width:0;min-height:40px;padding:8px 12px;border:0;border-radius:7px;background:#ff5a1f;color:#0b0b0c;font:inherit;font-weight:650;text-align:left;cursor:pointer}'
      + '.oav-send-url{flex:1;min-width:0;min-height:40px;padding:8px 10px;border:1px solid #3a3b40;border-radius:7px;background:#0b0b0c;color:#edebe5;font:13px ui-monospace,monospace}'
      + '.oav-send-x{flex:none;width:40px;height:40px;border:0;border-radius:7px;background:transparent;color:#a9a8a3;font:400 22px/1 system-ui,sans-serif;cursor:pointer}'
      + '.oav-send-ok{flex:1;min-width:0;padding:0 6px}';
    var style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);

    var bar = document.createElement('div');
    bar.className = 'oav-send';
    bar.setAttribute('role', 'region');
    bar.setAttribute('aria-label', T.send);
    var go = document.createElement('button');
    go.type = 'button';
    go.className = 'oav-send-go';
    go.textContent = T.send + ' →';
    go.setAttribute('data-oav-event', 'send_to_desktop');
    go.setAttribute('data-oav-method', canShare ? 'share' : 'copy');
    var x = document.createElement('button');
    x.type = 'button';
    x.className = 'oav-send-x';
    x.setAttribute('aria-label', T.close);
    x.textContent = '×';
    bar.appendChild(go);
    bar.appendChild(x);
    document.body.appendChild(bar);

    // a page may keep its own things at the bottom (oav-p5's 🎹 button and its message cards on the p5 examples, an example's guide):
    // the bar sits just above the fixed things it would cover or be covered by. A fixed thing as tall as half the screen is the page's
    // background (a full-screen canvas), not in the way. Placed again as the page's own scripts arrive and its cards come and go.
    function obstacleTop(r) {
      var top = Infinity, xs = [r.left + 6, r.left + r.width * 0.3, r.left + r.width * 0.6, r.right - 6];
      for (var i = 0; i < xs.length; i++) for (var k = 0; k < 2; k++) {
        var hits = document.elementsFromPoint(xs[i], k ? r.bottom - 4 : r.top + 4);
        for (var j = 0; j < hits.length; j++) {
          var el = hits[j];
          if (bar.contains(el) || el === document.documentElement || el === document.body) continue;
          for (var up = el; up && up !== document.body; up = up.parentElement) {
            if (getComputedStyle(up).position !== 'fixed') continue;
            var b = up.getBoundingClientRect();
            if (b.height < innerHeight / 2) top = Math.min(top, b.top);
            break;
          }
        }
      }
      return top;
    }
    function place() {
      if (!bar.isConnected || !document.elementsFromPoint) return;
      bar.style.bottom = '';
      for (var n = 0; n < 4; n++) {
        var r = bar.getBoundingClientRect(), top = obstacleTop(r);
        if (top === Infinity) return;
        if (top - r.height - 8 < 60) { bar.style.bottom = ''; return; }   // no room above them: the default place, over the page
        bar.style.bottom = Math.round(innerHeight - top + 8) + 'px';
      }
    }
    var tries = 0, timer = setInterval(function () { place(); if (++tries >= 20) clearInterval(timer); }, 500);   // the first ten seconds
    place();
    addEventListener('resize', place);

    var url = location.href.split('#')[0];
    function said(msg) { var p = document.createElement('span'); p.className = 'oav-send-ok'; p.setAttribute('role', 'status'); p.textContent = msg; bar.replaceChild(p, go); }
    function showUrl() {
      var input = document.createElement('input');
      input.className = 'oav-send-url'; input.readOnly = true; input.value = url; input.setAttribute('aria-label', T.send);
      bar.replaceChild(input, go); input.focus(); input.select();
    }
    go.addEventListener('click', function () {
      if (canShare) {
        navigator.share({ title: document.title, url: url }).catch(function () { /* the visitor closed the sheet: the bar stays */ });
        return;
      }
      var done = function () { said(T.copied); };
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(done, showUrl);
        else showUrl();
      } catch (e) { showUrl(); }
    });
    x.addEventListener('click', function () {
      try { sessionStorage.setItem(KEY, '1'); } catch (e) { /* storage blocked: it goes for this page only */ }
      bar.remove();
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', show); else show();
})();
