// rsefaaktas.com — behaviours. The page reads fine without this file.
(function () {
  // Full films live on Cloudflare R2, served through the bucket's own domain (not the rate-limited r2.dev address).
  var MEDIA = 'https://media.rsefaaktas.com/';
  var EASE = 'cubic-bezier(.22,.8,.2,1)';
  var GLIDE = 'cubic-bezier(.32,.72,0,1)';   // iOS-like: quick start, long soft landing (opening and closing)

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
  // Rails and the photo strip repeat their items; of an item and its copies, take the one nearest the middle of the screen.
  function nearestCopy(el) {
    var best = el, score = Infinity;
    [el].concat(el._twins || []).forEach(function (c) {
      var r = c.getBoundingClientRect(), d = Math.abs(r.left + r.width / 2 - innerWidth / 2) + (r.bottom < 0 || r.top > innerHeight ? 1e5 : 0);
      if (r.width && d < score) { score = d; best = c; }
    });
    return best;
  }
  // Card previews give their decoder back when they leave the screen or a film opens, and take it again
  // when they are needed. (A browser has only so many; with all of them busy a film shows a broken icon.)
  function release(v) {
    var s = v.querySelector('source');
    if (!s || !s.getAttribute('src') || !v._used) return;
    v.pause(); s.setAttribute('data-src', s.getAttribute('src')); s.removeAttribute('src'); v.load(); v._used = false;
  }
  function attach(v) {
    var s = v.querySelector('source');
    if (s && !s.getAttribute('src') && s.getAttribute('data-src')) { s.setAttribute('src', s.getAttribute('data-src')); v.load(); }
  }
  function preview(v) { attach(v); v._used = true; play(v); }
  function releaseAll() { Array.prototype.forEach.call(document.querySelectorAll('.card video, .frame video'), release); }
  var cards = Array.prototype.slice.call(document.querySelectorAll('.card[data-film]'));

  /* ---------- Full films, fetched quietly in the background ----------
     Nothing starts until the page itself has finished loading. On a normal connection each
     film is downloaded whole, two at a time, nearest first, so it plays instantly when opened.
     "More films" join the line only when their rail is approached. On mobile data or with
     data-saver on, only the start of a film is buffered and the rest streams while it plays. */
  var conn = navigator.connection || {};
  var light = !!conn.saveData || conn.type === 'cellular' || /(^|-)2g|3g/.test(conn.effectiveType || '');
  // Safari gives no connection info. On a phone we then assume a metered line and only stream.
  if (!navigator.connection && !hoverable) light = true;
  var films = {}, queue = [], later = [], active = 0, started = false;
  var roomy = hoverable && (navigator.deviceMemory === undefined || navigator.deviceMemory >= 4);
  cards.forEach(function (c) {
    var n = c.getAttribute('data-film');
    films[n] = { url: MEDIA + n + '.mp4', blob: null, state: 'idle' };
    if (!c.hasAttribute('data-later')) queue.push(n); else later.push(n);
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
    // once the selected films are in, a desktop with memory to spare carries on with the rest
    if (roomy && !queue.length && later.length) { queue = later; later = []; pump(); }
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
  // Streaming fallback (no CORS): a hidden player buffers the film. Every <video> holds a decoder and
  // phones run out of them quickly, so phones get none and desktops keep at most two.
  var warmed = [];
  function warm(name) {
    var f = films[name];
    if (light || f.warmed) return;
    var v = document.createElement('video');
    v.preload = 'auto'; v.muted = true; v.src = f.url;
    f.warmed = v; warmed.push(name);
    while (warmed.length > 2) {
      var old = films[warmed.shift()];
      if (old.warmed) { old.warmed.removeAttribute('src'); old.warmed.load(); old.warmed = null; }
    }
  }
  function near(name) { if (light) warm(name); else want(name); }
  function warmPage() {
    if (light) return;
    // card previews (0.2-0.6 MB each) go into the browser cache, one every 150 ms, so hover and scroll never
    // wait. Plain downloads, not players: a page full of loaded <video> elements runs out of decoders.
    var seen = {}, urls = [];
    Array.prototype.forEach.call(document.querySelectorAll('.card video source, .frame video source'), function (s) {
      var u = s.getAttribute('src') || s.getAttribute('data-src');
      if (u && !seen[u]) { seen[u] = true; urls.push(u); }
    });
    (function next() {
      if (!urls.length) return;
      fetch(urls.shift()).catch(function () {});
      setTimeout(next, 150);
    })();
    // photos further down the page: fetch and decode them now instead of on arrival
    Array.prototype.forEach.call(document.querySelectorAll('img[loading="lazy"]'), function (im, k) {
      setTimeout(function () { im.loading = 'eager'; if (im.decode) im.decode().catch(function () {}); }, 60 * k);
    });
  }
  function start() { if (started) return; started = true; warmPage(); pump(); }
  function whenQuiet(fn) {
    if ('requestIdleCallback' in window) requestIdleCallback(fn, { timeout: 2500 }); else setTimeout(fn, 1200);
  }
  if (document.readyState === 'complete') whenQuiet(start);
  else window.addEventListener('load', function () { whenQuiet(start); });

  /* ---------- Rails: the films drift by on their own, like the logo strip ----------
     The row is repeated so it never ends. It is still an ordinary scroller: a swipe, the wheel or the
     arrows move it, and the drift picks up again a moment later. It rests under the pointer or a finger,
     while a film or photo is open, and when it is off screen. With reduced motion nothing drifts and the
     rail stays a plain row with arrows. */
  Array.prototype.forEach.call(document.querySelectorAll('[data-rail], .strip'), function (rail) {
    var isStrip = rail.classList.contains('strip');
    var track = isStrip ? rail : rail.querySelector('.rail-track');
    var btns = rail.querySelectorAll('.rail-nav button');
    var originals = Array.prototype.slice.call(track.children);
    var flowing = !reduce && 'requestAnimationFrame' in window && originals.length > 2;
    var items = originals, half = 0, pos = 0, lastSet = 0, vel = 0, push = 0, userAt = 0;
    var held = false, over = false, seen = true, last = 0, keyAt = -1e9;

    if (flowing) {
      // enough copies that one set is always wider than any screen it will meet
      var setW = originals.length * ((originals[0].offsetWidth || 200) + 16);
      var copies = Math.min(3, Math.max(1, Math.ceil(Math.max(window.innerWidth, screen.width || 0, 1024) / setW)));
      for (var n = 0; n < copies; n++) originals.forEach(function (li) {
        var twin = li.cloneNode(true), card = li.querySelector('.card'), tc = twin.querySelector('.card');
        twin.setAttribute('aria-hidden', 'true');
        if (card && tc) {
          tc.tabIndex = -1; tc.removeAttribute('data-film');
          (card._twins = card._twins || []).push(tc);
          tc.addEventListener('click', function () { card.click(); });
          tc.addEventListener('pointerenter', function () { near(card.getAttribute('data-film')); });
        }
        var img = isStrip && li.querySelector('img'), ti = img && twin.querySelector('img');
        if (img && ti) {                // a copied photo opens the original in the viewer
          ti.setAttribute('data-twin', ''); ti.loading = 'eager';
          (img._twins = img._twins || []).push(ti);
          ti.addEventListener('click', function () { img.click(); });
        }
        track.appendChild(twin);
      });
      items = Array.prototype.slice.call(track.children);
      track.classList.add('flowing');
    }
    function measure() { if (flowing) half = items[originals.length].offsetLeft - items[0].offsetLeft; }
    // Mouse only: cards turn slightly as they travel (rails), and whatever is under the pointer swells a little,
    // its neighbours less, like the Mac Dock. Each item eases toward its size, so nothing jumps.
    var mx = null, settling = 0;
    function tilt(dt) {
      if (reduce || !hoverable) return;
      var box = track.getBoundingClientRect(), mid = box.left + box.width / 2, halfW = box.width / 2;
      var k = Math.min(1, (dt || 16) / 140), moving = 0;
      items.forEach(function (li) {
        var r = li.getBoundingClientRect();
        if (r.right < box.left - 200 || r.left > box.right + 200) { li._m = 0; return; }
        var c = r.left + r.width / 2;
        var want = mx === null ? 0 : Math.max(0, 1 - Math.abs(c - mx) / (r.width * 1.25));
        want = want * want * (3 - 2 * want);
        li._m = (li._m || 0) + (want - (li._m || 0)) * k;
        if (Math.abs(want - li._m) > 0.002) moving = 1;
        var grow = 1 + li._m * Math.min(isStrip ? 0.045 : 0.035, 20 / r.width);   // never wider than the gap allows
        li.style.setProperty('--m', li._m.toFixed(3));
        if (isStrip) { li.style.transform = 'scale(' + grow.toFixed(4) + ')'; return; }
        var d = Math.max(-1.2, Math.min(1.2, (c - mid) / halfW));
        li.style.transform = 'rotateY(' + (-d * 7).toFixed(2) + 'deg) scale(' + ((1 - Math.abs(d) * 0.035) * grow).toFixed(4) + ')';
      });
      settling = moving;
    }
    var ticking = false;
    function update() {
      ticking = false;
      if (!flowing && btns.length) {
        var max = track.scrollWidth - track.clientWidth - 2;
        btns[0].disabled = track.scrollLeft <= 2; btns[1].disabled = track.scrollLeft >= max;
      }
      tilt();
    }
    function ask() { if (!ticking) { ticking = true; requestAnimationFrame(update); } }
    track.addEventListener('scroll', function () {
      // a scroll we did not make ourselves is the visitor's: follow it and wait
      if (flowing && Math.abs(track.scrollLeft - lastSet) > 2) { userAt = performance.now(); pos = track.scrollLeft; push = 0; }
      ask();
    }, { passive: true });
    window.addEventListener('resize', function () { measure(); ask(); });
    Array.prototype.forEach.call(btns, function (b) {
      b.addEventListener('click', function () {
        var by = Number(b.getAttribute('data-dir')) * track.clientWidth * 0.8;
        if (flowing) { push += by; userAt = 0; }
        else track.scrollBy({ left: by, behavior: reduce ? 'auto' : 'smooth' });
      });
    });
    measure(); update();
    if (!flowing) return;

    track.addEventListener('touchstart', function () { held = true; }, { passive: true });
    ['touchend', 'touchcancel'].forEach(function (e) {
      track.addEventListener(e, function () { held = false; userAt = performance.now(); }, { passive: true });
    });
    track.addEventListener('keydown', function () { keyAt = performance.now(); });
    track.addEventListener('focusin', function (e) { if (e.target.matches(':focus-visible')) keyAt = performance.now(); });
    if (hoverable) {
      track.addEventListener('mouseenter', function () { over = true; });
      track.addEventListener('mouseleave', function () { over = false; mx = null; settling = 1; });
      track.addEventListener('mousemove', function (e) { mx = e.clientX; settling = 1; }, { passive: true });
    }
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (es) { seen = es[es.length - 1].isIntersecting; }, { rootMargin: '100px' }).observe(track);
    }
    // px per second; the photo strip and the second rail a touch slower than the first
    var speed = (hoverable ? 26 : 20) * (isStrip ? 0.85 : rail.classList.contains('rail-more') ? 0.8 : 1);
    function wrap(centre) {
      var max = track.scrollWidth - track.clientWidth;
      if (half <= 0 || max < half) return;
      if (centre) {               // after the visitor let go: sit where there is room to both sides
        while (pos - half >= 0 && Math.abs(pos - half - max / 2) < Math.abs(pos - max / 2)) pos -= half;
        while (pos + half <= max && Math.abs(pos + half - max / 2) < Math.abs(pos - max / 2)) pos += half;
      }
      while (pos > max - 2) pos -= half;
      while (pos < 0) pos += half;
    }
    var wasUser = false;
    function frame(now) {
      requestAnimationFrame(frame);
      var dt = Math.min(64, now - (last || now)); last = now;
      if (!seen || document.hidden) return;
      if (!half) measure();
      if (over || settling) tilt(dt);                                          // the Dock swell follows the pointer
      var user = held || now - userAt < 1600;
      if (user) { wasUser = true; vel = 0; pos = track.scrollLeft; return; }   // leave native scrolling alone
      var tabbing = now - keyAt < 6000 && track.contains(document.activeElement);   // someone is tabbing through the cards
      var rest = over || tabbing || !!document.querySelector('dialog[open]');
      vel += ((rest ? 0 : speed) - vel) * Math.min(1, dt / 420);               // eases in and out of the drift
      var by = vel * dt / 1000;
      if (Math.abs(push) > 0.5) { var p = push * Math.min(1, dt / 160); push -= p; by += p; } else push = 0;
      if (!wasUser && Math.abs(by) < 0.01) return;
      pos += by; wrap(wasUser); wasUser = false;
      track.scrollLeft = pos; lastSet = track.scrollLeft;
      if (Math.abs(lastSet - pos) > 1.5) pos = lastSet;
      if (!over && !settling) tilt(dt);
    }
    requestAnimationFrame(frame);
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
    var v = current;
    if (!v) {
      v = document.createElement('video');
      v.controls = true; v.playsInline = true; v.setAttribute('playsinline', ''); v.autoplay = true;
      v.addEventListener('error', function () {
        // a cached copy that will not play falls back to streaming the file directly
        var film = films[v.getAttribute('data-name')];
        if (film && v.src !== film.url) { v.src = film.url; play(v); }
        else if (film && !v._retried) { v._retried = true; releaseAll(); v.src = film.url; v.load(); play(v); }
        else { msg.hidden = false; }
      });
      stage.textContent = ''; stage.appendChild(v); current = v;
    }
    v.pause(); v.setAttribute('data-name', name); v.poster = poster; v._retried = false;
    v.src = f.blob || f.url;
    play(v);
    // keep the neighbours ready so stepping through is instant
    [index - 1, index + 1].forEach(function (i) { var c = cards[(i + cards.length) % cards.length]; near(c.getAttribute('data-film')); });
  }
  function fromCard(card) {           // where the card sits, relative to the stage's resting place
    card = nearestCopy(card);
    var c = card.getBoundingClientRect(), s = stage.getBoundingClientRect();
    if (!c.width || c.bottom < 0 || c.top > innerHeight || c.right < 0 || c.left > innerWidth) return null;
    var k = c.width / s.width;
    return { t: 'translate(' + (c.left + c.width / 2 - s.left - s.width / 2) + 'px,' + (c.top + c.height / 2 - s.top - s.height / 2) + 'px) scale(' + k + ')',
             r: (parseFloat(getComputedStyle(card).borderRadius) || 0) / k + 'px' };
  }
  function openFilm(card) {
    if (dlg.open) return;
    index = cards.indexOf(card);
    releaseAll();
    if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', '');
    mount(card);
    var from = canAnimate && fromCard(card);
    requestAnimationFrame(function () { dlg.classList.add('lit'); });
    if (from) {
      stage.animate([{ transform: from.t, borderRadius: from.r }, { transform: 'none', borderRadius: getComputedStyle(stage).borderRadius }],
        { duration: 700, easing: GLIDE });
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
      { duration: 620, easing: GLIDE, fill: 'forwards' });
    after(a, 620, function () { done(); a.cancel(); });
  }
  // A still of what is on screen, laid exactly over `el`, so it can leave while the next one arrives.
  function ghostOf(el, host, paint) {
    var r = el.getBoundingClientRect(), c = document.createElement('canvas'), dpr = Math.min(window.devicePixelRatio || 1, 2);
    c.width = Math.round(r.width * dpr); c.height = Math.round(r.height * dpr);
    c.className = 'ghost';
    c.style.cssText = 'left:' + r.left + 'px;top:' + r.top + 'px;width:' + r.width + 'px;height:' + r.height + 'px;border-radius:' + getComputedStyle(el).borderRadius;
    try { paint(c.getContext('2d'), c.width, c.height); } catch (e) {}
    host.appendChild(c);
    return c;
  }
  function turn(ghost, el, dir, done) {
    var away = 'translateX(' + (-dir * 62) + '%) rotateY(' + (dir * 38) + 'deg) scale(.8)';
    var from = 'translateX(' + (dir * 62) + '%) rotateY(' + (-dir * 38) + 'deg) scale(.8)';
    ghost.animate([{ transform: 'none', opacity: 1 }, { transform: away, opacity: 0 }], { duration: 620, easing: EASE, fill: 'forwards' });
    var inn = el.animate([{ transform: from, opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 620, easing: EASE });
    after(inn, 620, function () { ghost.remove(); done(); });
  }
  function step(dir) {
    if (!dlg.open || busy) return;
    index = (index + dir + cards.length) % cards.length;
    var card = cards[index];
    nearestCopy(card).closest('li').scrollIntoView({ block: 'nearest', inline: 'center' });   // so closing lands on the right card
    if (!canAnimate) return mount(card);
    busy = true;
    var old = current;
    var ghost = ghostOf(stage, dlg, function (g, w, h) {
      g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
      if (old && old.videoWidth) {
        var k = Math.min(w / old.videoWidth, h / old.videoHeight), vw = old.videoWidth * k, vh = old.videoHeight * k;
        g.drawImage(old, (w - vw) / 2, (h - vh) / 2, vw, vh);
      }
    });
    mount(card);
    turn(ghost, stage, dir, function () { busy = false; });
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

  /* ---------- Photo viewer: a photo grows to fill the screen, like a film does ---------- */
  (function () {
    var vdlg = document.getElementById('viewer');
    if (!vdlg) return;
    var big = document.getElementById('viewer-img'), cap = document.getElementById('viewer-cap');
    var vglow = document.getElementById('viewer-glow');
    var shots = Array.prototype.slice.call(document.querySelectorAll('main figure img')).filter(function (el) { return !el.hasAttribute('data-twin'); });
    var at = -1, vbusy = false;

    function rectOf(el) {               // the photo's place on the page, relative to the big one
      el = nearestCopy(el);
      var c = el.getBoundingClientRect(), s = big.getBoundingClientRect();
      if (!c.width || !s.width || c.bottom < 0 || c.top > innerHeight || c.right < 0 || c.left > innerWidth) return null;
      var k = c.width / s.width;
      return { t: 'translate(' + (c.left + c.width / 2 - s.left - s.width / 2) + 'px,' + (c.top + c.height / 2 - s.top - s.height / 2) + 'px) scale(' + k + ')',
               r: (parseFloat(getComputedStyle(el).borderRadius) || 0) / k + 'px' };
    }
    function show(i) {
      var el = shots[i]; at = i;
      big.src = el.currentSrc || el.src; big.alt = el.alt;
      big.width = el.naturalWidth || el.width; big.height = el.naturalHeight || el.height;
      var fc = el.closest('figure').querySelector('figcaption');
      cap.textContent = fc ? fc.textContent : '';
      cap.hidden = !fc;
      vglow.style.backgroundImage = 'url("' + big.src + '")';
    }
    function open(i) {
      if (vdlg.open) return;
      show(i);
      if (vdlg.showModal) vdlg.showModal(); else vdlg.setAttribute('open', '');
      requestAnimationFrame(function () { vdlg.classList.add('lit'); });
      var from = canAnimate && rectOf(shots[i]);
      if (from) big.animate([{ transform: from.t, borderRadius: from.r }, { transform: 'none', borderRadius: getComputedStyle(big).borderRadius }],
        { duration: 680, easing: GLIDE });
    }
    function close() {
      if (!vdlg.open || vbusy) return;
      var el = shots[at], to = canAnimate && rectOf(el);
      function done() {
        if (vdlg.close) vdlg.close(); else vdlg.removeAttribute('open');
        vbusy = false; el.focus({ preventScroll: true });
      }
      vdlg.classList.remove('lit');
      if (!canAnimate) return done();
      vbusy = true;
      var a = big.animate(to ? [{ transform: 'none' }, { transform: to.t, borderRadius: to.r }]
                             : [{ transform: 'none', opacity: 1 }, { transform: 'scale(.94)', opacity: 0 }],
        { duration: 600, easing: GLIDE, fill: 'forwards' });
      after(a, 600, function () { done(); a.cancel(); });
    }
    function go(dir) {
      if (!vdlg.open || vbusy) return;
      var next = (at + dir + shots.length) % shots.length;
      nearestCopy(shots[next]).scrollIntoView({ block: 'center', inline: 'center' });   // so closing lands on the right photo
      if (!canAnimate) return show(next);
      vbusy = true;
      var ghost = ghostOf(big, vdlg, function (g, w, h) { g.drawImage(big, 0, 0, w, h); });
      show(next);
      turn(ghost, big, dir, function () { vbusy = false; });
    }
    shots.forEach(function (el, i) {
      el.tabIndex = 0; el.setAttribute('role', 'button');
      el.addEventListener('click', function () { open(i); });
      el.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(i); } });
    });
    document.getElementById('viewer-close').addEventListener('click', close);
    document.getElementById('viewer-prev').addEventListener('click', function () { go(-1); });
    document.getElementById('viewer-next').addEventListener('click', function () { go(1); });
    big.addEventListener('click', close);
    vdlg.addEventListener('click', function (e) { if (e.target === vdlg || e.target === vglow) close(); });
    vdlg.addEventListener('cancel', function (e) { e.preventDefault(); close(); });
    vdlg.addEventListener('keydown', function (e) { if (e.key === 'ArrowLeft') go(-1); else if (e.key === 'ArrowRight') go(1); });
    var x0 = null, y0 = null;
    big.addEventListener('touchstart', function (e) { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; }, { passive: true });
    big.addEventListener('touchend', function (e) {
      if (x0 === null) return;
      var dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0; x0 = null;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) { e.preventDefault(); go(dx < 0 ? 1 : -1); }
    });
  })();

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
      if (e.isIntersecting && !document.querySelector('dialog[open]')) preview(e.target); else e.target.pause();
    });
  }, { threshold: 0.6 });
  // off screen (or scrolled out of its rail): give the decoder back
  var away = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) { if (!e.isIntersecting) release(e.target); });
  });

  var vids = Array.prototype.slice.call(document.querySelectorAll('.frame video, .card video'));
  vids.forEach(function (v) {
    away.observe(v);
    if (v.hasAttribute('data-autoplay') || !hoverable) {
      inView.observe(v);
    } else {
      var card = v.closest('.card');
      card.addEventListener('mouseenter', function () { preview(v); });
      card.addEventListener('focus', function () { preview(v); });
      card.addEventListener('mouseleave', function () { v.pause(); });
      card.addEventListener('blur', function () { v.pause(); });
    }
  });
  // after a film or photo closes, the previews on screen pick up again
  Array.prototype.forEach.call(document.querySelectorAll('dialog'), function (d) {
    d.addEventListener('close', function () {
      vids.forEach(function (v) { if (v.hasAttribute('data-autoplay') || !hoverable) { inView.unobserve(v); inView.observe(v); } });
    });
  });
})();
