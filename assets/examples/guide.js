// The guide card on an example page (assets/examples/guide.css). The card is complete HTML; this file only adds
//   · a Hide / Guide button: the card folds to a pill, and remembers it (localStorage "oav-guide")
//   · the EN | 中文 switch, remembered in "oav-ui" (the same key example 15 and the examples index use)
// First visit on a wide screen: open. Phones: folded. Nothing here touches the example itself.
(function () {
  var card = document.getElementById('oav-guide');
  if (!card) return;
  var tools = card.querySelector('.g-tools'), toggle = card.querySelector('.g-toggle');
  var get = function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } };
  var set = function (k, v) { try { localStorage.setItem(k, v); } catch (e) { /* private mode */ } };

  function ui(v) {
    card.dataset.ui = v;
    card.querySelectorAll('.g-lang').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.set === v)); });
    paint();
  }
  function paint() {
    var open = !card.classList.contains('is-collapsed'), zh = card.dataset.ui === 'zh';
    toggle.setAttribute('aria-expanded', String(open));
    toggle.textContent = open ? (zh ? toggle.dataset.hideZh : toggle.dataset.hide) : (zh ? toggle.dataset.showZh : toggle.dataset.show);
  }
  function fold(collapsed, remember) {
    card.classList.toggle('is-collapsed', collapsed);
    if (remember) set('oav-guide', collapsed ? 'closed' : 'open');
    paint();
  }

  var saved = get('oav-ui');
  var lang = saved || (/^zh/i.test(navigator.language || '') ? 'zh' : 'en');
  var wasClosed = get('oav-guide');
  tools.hidden = false;
  card.querySelectorAll('.g-lang').forEach(function (b) { b.addEventListener('click', function () { set('oav-ui', b.dataset.set); ui(b.dataset.set); }); });
  toggle.addEventListener('click', function () { fold(!card.classList.contains('is-collapsed'), true); });
  card.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !card.classList.contains('is-collapsed')) { fold(true, true); toggle.focus(); } });
  ui(lang);
  fold(wasClosed ? wasClosed === 'closed' : window.matchMedia('(max-width: 640px)').matches, false);
})();
