// rsefaaktas.com — small behaviours only; the page reads fine without this file.
(function () {
  // Full films live on Cloudflare R2. Change this one line when media.rsefaaktas.com is connected.
  var MEDIA = 'https://pub-76ee4d9ab6aa4a3988c80d9618f887d1.r2.dev/';

  var root = document.documentElement;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var hoverable = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  // Opening: start the sequence once the typeface is in, so the name does not jump.
  function ready() { root.classList.add('ready'); }
  if (document.fonts && document.fonts.ready) {
    Promise.race([document.fonts.ready, new Promise(function (r) { setTimeout(r, 1200); })]).then(ready);
  } else { ready(); }

  // Top bar appears after the opening has been scrolled past.
  var bar = document.getElementById('bar');
  var hero = document.querySelector('.hero');
  function onScroll() { bar.classList.toggle('on', window.scrollY > hero.offsetHeight * 0.6); }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  function play(v) { var p = v.play(); if (p && p.catch) p.catch(function () {}); }
  var cards = Array.prototype.slice.call(document.querySelectorAll('.card[data-film]'));

  /* ---------- Full films, fetched quietly in the background ----------
     Nothing here starts until the page itself has finished loading.
     On a normal connection each film is downloaded whole, two at a time, nearest first,
     so it plays instantly when opened. On mobile data or with data-saver on, only the
     start of a film is buffered and the rest streams while it plays. */
  var conn = navigator.connection || {};
  var light = !!conn.saveData || conn.type === 'cellular' || /(^|-)2g|3g/.test(conn.effectiveType || '');
  var films = {};   // name -> { url, blob, state }
  var queue = [];   // names waiting to download, most wanted first
  var active = 0;
  cards.forEach(function (c) {
    var n = c.getAttribute('data-film');
    films[n] = { url: MEDIA + n + '.mp4', blob: null, state: 'idle' };
    queue.push(n);
  });

  function want(name) {            // move a film to the front of the line
    var i = queue.indexOf(name);
    if (i > 0) { queue.splice(i, 1); queue.unshift(name); }
    pump();
  }
  function pump() {
    if (!started || light) return;
    while (active < 2 && queue.length) fetchFilm(queue.shift());
  }
  function fetchFilm(name) {
    var f = films[name];
    if (f.state !== 'idle') return;
    f.state = 'loading'; active++;
    fetch(f.url, { mode: 'cors' })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.blob(); })
      .then(function (b) { f.blob = URL.createObjectURL(b); f.state = 'ready'; })
      .catch(function () { f.state = 'stream'; warm(name); })   // no CORS or offline: let the player stream it
      .then(function () { active--; pump(); });
  }
  function warm(name) {            // buffer just the start of a film
    var f = films[name];
    if (f.warmed) return;
    var v = document.createElement('video');
    v.preload = light ? 'metadata' : 'auto'; v.muted = true; v.src = f.url;
    f.warmed = v;
  }
  var started = false;
  function start() {
    if (started) return; started = true;
    if (light) return;             // light mode warms a film only when its card is approached
    pump();
  }
  function whenQuiet(fn) {
    if ('requestIdleCallback' in window) requestIdleCallback(fn, { timeout: 2500 }); else setTimeout(fn, 1200);
  }
  if (document.readyState === 'complete') whenQuiet(start);
  else window.addEventListener('load', function () { whenQuiet(start); });

  /* ---------- Player ---------- */
  var dlg = document.getElementById('player');
  var stage = document.getElementById('player-stage');
  var titleEl = document.getElementById('player-title');
  var msg = document.getElementById('player-msg');
  var current = null, opener = null;

  function openFilm(card) {
    var name = card.getAttribute('data-film'), f = films[name];
    opener = card; msg.hidden = true;
    titleEl.textContent = card.getAttribute('data-title');
    var v = document.createElement('video');
    v.controls = true; v.playsInline = true; v.autoplay = true;
    v.poster = card.querySelector('video').poster;
    v.src = f.blob || f.url;
    v.addEventListener('error', function () { msg.hidden = false; });
    stage.textContent = ''; stage.appendChild(v); current = v;
    cards.forEach(function (c) { c.querySelector('video').pause(); });
    if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', '');
    play(v);
  }
  function closeFilm() {
    if (current) { current.pause(); current.removeAttribute('src'); current.load(); current = null; }
    stage.textContent = '';
    if (dlg.close && dlg.open) dlg.close(); else dlg.removeAttribute('open');
    if (opener) opener.focus();
  }
  document.getElementById('player-close').addEventListener('click', closeFilm);
  dlg.addEventListener('click', function (e) { if (e.target === dlg) closeFilm(); });
  dlg.addEventListener('cancel', function (e) { e.preventDefault(); closeFilm(); });

  cards.forEach(function (card) {
    var name = card.getAttribute('data-film');
    card.addEventListener('click', function () { openFilm(card); });
    card.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openFilm(card); }
    });
    function near() { if (light) warm(name); else want(name); }
    card.addEventListener('pointerenter', near);
    card.addEventListener('focus', near);
  });

  if (!('IntersectionObserver' in window)) {
    document.querySelectorAll('.frame').forEach(function (f) { f.classList.add('in'); });
    return;
  }

  // The two frames open once, the first time they are seen.
  // (Watch the row, not the frames: a fully clipped element never counts as visible.)
  var frames = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (!e.isIntersecting) return;
      e.target.querySelectorAll('.frame').forEach(function (f) { f.classList.add('in'); });
      frames.unobserve(e.target);
    });
  }, { threshold: 0.2 });
  document.querySelectorAll('.two-frames').forEach(function (row) { frames.observe(row); });

  // Films whose cards are coming up on screen jump the download queue.
  var approaching = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (!e.isIntersecting) return;
      var name = e.target.getAttribute('data-film');
      if (light) warm(name); else want(name);
      approaching.unobserve(e.target);
    });
  }, { rootMargin: '600px 0px' });
  cards.forEach(function (c) { approaching.observe(c); });

  if (reduce) return; // posters only; nothing moves on its own

  // Silent previews play while on screen (touch) or under the pointer (mouse).
  var inView = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (e.isIntersecting && !dlg.open) play(e.target); else e.target.pause();
    });
  }, { threshold: 0.6 });

  document.querySelectorAll('.frame video, .card video').forEach(function (v) {
    if (v.hasAttribute('data-autoplay') || !hoverable) {
      inView.observe(v);
    } else {
      var card = v.closest('.card');
      card.addEventListener('mouseenter', function () { play(v); });
      card.addEventListener('focus', function () { play(v); });
      card.addEventListener('mouseleave', function () { v.pause(); });
      card.addEventListener('blur', function () { v.pause(); });
    }
  });
})();
