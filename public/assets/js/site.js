// rsefaaktas.com — behaviours. The page reads fine without this file.
(function () {
  // Full films live on Cloudflare R2. Change this one line when media.rsefaaktas.com is connected.
  var MEDIA = 'https://pub-76ee4d9ab6aa4a3988c80d9618f887d1.r2.dev/';
  var EASE = 'cubic-bezier(.22,.8,.2,1)';

  var root = document.documentElement;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var hoverable = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  var canAnimate = !reduce && 'animate' in Element.prototype;

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

  // Run fn once when an animation ends; the timer covers browsers that drop the finish event.
  function after(anim, ms, fn) {
    var done = false;
    function go() { if (done) return; done = true; fn(); }
    anim.onfinish = go; anim.oncancel = go; setTimeout(go, ms + 80);
  }
  function play(v) { var p = v.play(); if (p && p.catch) p.catch(function () {}); }
  var cards = Array.prototype.slice.call(document.querySelectorAll('.card[data-film]'));

  /* ---------- Full films, fetched quietly in the background ----------
     Nothing starts until the page itself has finished loading. On a normal connection each
     film is downloaded whole, two at a time, nearest first, so it plays instantly when opened.
     "More films" join the line only when their rail is approached. On mobile data or with
     data-saver on, only the start of a film is buffered and the rest streams while it plays. */
  var conn = navigator.connection || {};
  var light = !!conn.saveData || conn.type === 'cellular' || /(^|-)2g|3g/.test(conn.effectiveType || '');
  var films = {}, queue = [], active = 0, started = false;
  cards.forEach(function (c) {
    var n = c.getAttribute('data-film');
    films[n] = { url: MEDIA + n + '.mp4', blob: null, state: 'idle' };
    if (!c.hasAttribute('data-later')) queue.push(n);
  });
  function want(name) {
    var i = queue.indexOf(name);
    if (i > 0) { queue.splice(i, 1); queue.unshift(name); }
    else if (i < 0 && films[name].state === 'idle') queue.unshift(name);
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
      .catch(function () { f.state = 'stream'; warm(name); })
      .then(function () { active--; pump(); });
  }
  function warm(name) {
    var f = films[name];
    if (f.warmed) return;
    var v = document.createElement('video');
    v.preload = light ? 'metadata' : 'auto'; v.muted = true; v.src = f.url;
    f.warmed = v;
  }
  function near(name) { if (light) warm(name); else want(name); }
  function start() { if (started) return; started = true; pump(); }
  function whenQuiet(fn) {
    if ('requestIdleCallback' in window) requestIdleCallback(fn, { timeout: 2500 }); else setTimeout(fn, 1200);
  }
  if (document.readyState === 'complete') whenQuiet(start);
  else window.addEventListener('load', function () { whenQuiet(start); });

  /* ---------- Rails: arrows, and a slight turn of the cards as they travel ---------- */
  Array.prototype.forEach.call(document.querySelectorAll('[data-rail]'), function (rail) {
    var track = rail.querySelector('.rail-track');
    var btns = rail.querySelectorAll('.rail-nav button');
    var items = Array.prototype.slice.call(track.children);
    var ticking = false;
    function update() {
      ticking = false;
      var max = track.scrollWidth - track.clientWidth - 2;
      if (btns.length) { btns[0].disabled = track.scrollLeft <= 2; btns[1].disabled = track.scrollLeft >= max; }
      if (reduce) return;
      var box = track.getBoundingClientRect(), mid = box.left + box.width / 2, half = box.width / 2;
      items.forEach(function (li) {
        var r = li.getBoundingClientRect();
        var d = Math.max(-1.2, Math.min(1.2, (r.left + r.width / 2 - mid) / half));
        li.style.transform = 'rotateY(' + (-d * 7).toFixed(2) + 'deg) scale(' + (1 - Math.abs(d) * 0.035).toFixed(3) + ')';
      });
    }
    function ask() { if (!ticking) { ticking = true; requestAnimationFrame(update); } }
    track.addEventListener('scroll', ask, { passive: true });
    window.addEventListener('resize', ask);
    Array.prototype.forEach.call(btns, function (b) {
      b.addEventListener('click', function () {
        track.scrollBy({ left: Number(b.getAttribute('data-dir')) * track.clientWidth * 0.8, behavior: reduce ? 'auto' : 'smooth' });
      });
    });
    update();
  });

  /* ---------- Logo flow: holds still under a finger ---------- */
  Array.prototype.forEach.call(document.querySelectorAll('[data-flow]'), function (flow) {
    flow.addEventListener('touchstart', function () { flow.classList.add('held'); }, { passive: true });
    ['touchend', 'touchcancel'].forEach(function (e) {
      flow.addEventListener(e, function () { flow.classList.remove('held'); }, { passive: true });
    });
  });

  /* ---------- Player ---------- */
  var dlg = document.getElementById('player');
  var stage = document.getElementById('player-stage');
  var glow = document.getElementById('player-glow');
  var titleEl = document.getElementById('player-title');
  var kindEl = document.getElementById('player-kind');
  var msg = document.getElementById('player-msg');
  var index = -1, current = null, busy = false;

  function mount(card) {
    var name = card.getAttribute('data-film'), f = films[name];
    var poster = card.querySelector('video').poster;
    msg.hidden = true;
    titleEl.textContent = card.getAttribute('data-title');
    kindEl.textContent = card.getAttribute('data-kind') || '';
    glow.style.backgroundImage = 'url("' + poster + '")';
    if (current) { current.pause(); current.removeAttribute('src'); current.load(); }
    var v = document.createElement('video');
    v.controls = true; v.playsInline = true; v.autoplay = true; v.poster = poster;
    v.src = f.blob || f.url;
    v.addEventListener('error', function () { msg.hidden = false; });
    stage.textContent = ''; stage.appendChild(v); current = v;
    play(v);
    // keep the neighbours ready so stepping through is instant
    [index - 1, index + 1].forEach(function (i) { var c = cards[(i + cards.length) % cards.length]; near(c.getAttribute('data-film')); });
  }
  function fromCard(card) {           // where the card sits, relative to the stage's resting place
    var c = card.getBoundingClientRect(), s = stage.getBoundingClientRect();
    if (!c.width || c.bottom < 0 || c.top > innerHeight || c.right < 0 || c.left > innerWidth) return null;
    var k = c.width / s.width;
    return { t: 'translate(' + (c.left + c.width / 2 - s.left - s.width / 2) + 'px,' + (c.top + c.height / 2 - s.top - s.height / 2) + 'px) scale(' + k + ')',
             r: (parseFloat(getComputedStyle(card).borderRadius) || 0) / k + 'px' };
  }
  function openFilm(card) {
    if (dlg.open) return;
    index = cards.indexOf(card);
    cards.forEach(function (c) { c.querySelector('video').pause(); });
    if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', '');
    mount(card);
    var from = canAnimate && fromCard(card);
    requestAnimationFrame(function () { dlg.classList.add('lit'); });
    if (from) {
      stage.animate([{ transform: from.t, borderRadius: from.r }, { transform: 'none', borderRadius: getComputedStyle(stage).borderRadius }],
        { duration: 620, easing: EASE });
    }
  }
  function closeFilm() {
    if (!dlg.open || busy) return;
    var card = cards[index];
    var to = canAnimate && card && fromCard(card);
    function done() {
      if (current) { current.pause(); current.removeAttribute('src'); current.load(); current = null; }
      stage.textContent = '';
      if (dlg.close) dlg.close(); else dlg.removeAttribute('open');
      busy = false;
      if (card) card.focus({ preventScroll: true });
    }
    dlg.classList.remove('lit');
    if (!canAnimate) return done();
    busy = true;
    if (current) current.pause();
    var a = stage.animate(to ? [{ transform: 'none' }, { transform: to.t, borderRadius: to.r }]
                             : [{ transform: 'none', opacity: 1 }, { transform: 'scale(.94)', opacity: 0 }],
      { duration: 460, easing: EASE, fill: 'forwards' });
    after(a, 460, function () { done(); a.cancel(); });
  }
  function step(dir) {
    if (!dlg.open || busy) return;
    index = (index + dir + cards.length) % cards.length;
    var card = cards[index];
    card.closest('li').scrollIntoView({ block: 'nearest', inline: 'center' });   // so closing lands on the right card
    if (!canAnimate) return mount(card);
    busy = true;
    var out = stage.animate([{ transform: 'none', opacity: 1 },
      { transform: 'translateX(' + (-dir * 46) + '%) rotateY(' + (dir * 32) + 'deg) scale(.84)', opacity: 0 }],
      { duration: 300, easing: 'cubic-bezier(.5,0,.8,.4)', fill: 'forwards' });
    after(out, 300, function () {
      mount(card);
      out.cancel();
      var inn = stage.animate([{ transform: 'translateX(' + (dir * 46) + '%) rotateY(' + (-dir * 32) + 'deg) scale(.84)', opacity: 0 },
        { transform: 'none', opacity: 1 }], { duration: 520, easing: EASE });
      after(inn, 520, function () { busy = false; });
    });
  }
  document.getElementById('player-close').addEventListener('click', closeFilm);
  document.getElementById('player-prev').addEventListener('click', function () { step(-1); });
  document.getElementById('player-next').addEventListener('click', function () { step(1); });
  dlg.addEventListener('click', function (e) { if (e.target === dlg || e.target === glow) closeFilm(); });
  dlg.addEventListener('cancel', function (e) { e.preventDefault(); closeFilm(); });
  dlg.addEventListener('keydown', function (e) {
    if (e.target.tagName === 'VIDEO') return;       // leave the arrow keys to the film's own controls
    if (e.key === 'ArrowLeft') step(-1); else if (e.key === 'ArrowRight') step(1);
  });
  // swipe sideways on the film to move between films
  var sx = null, sy = null;
  stage.addEventListener('touchstart', function (e) { sx = e.touches[0].clientX; sy = e.touches[0].clientY; }, { passive: true });
  stage.addEventListener('touchend', function (e) {
    if (sx === null) return;
    var dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy; sx = null;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) step(dx < 0 ? 1 : -1);
  }, { passive: true });

  cards.forEach(function (card) {
    var name = card.getAttribute('data-film');
    card.addEventListener('click', function () { openFilm(card); });
    card.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openFilm(card); }
    });
    card.addEventListener('pointerenter', function () { near(name); });
    card.addEventListener('focus', function () { near(name); });
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
      near(e.target.getAttribute('data-film'));
      approaching.unobserve(e.target);
    });
  }, { rootMargin: '600px 200px' });
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
