// rsefaaktas.com — small behaviours only; the page works without this file.
(function () {
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
  function onScroll() {
    bar.classList.toggle('on', window.scrollY > hero.offsetHeight * 0.6);
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  function play(v) { var p = v.play(); if (p && p.catch) p.catch(function () {}); }

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

  if (reduce) return; // posters only; nothing moves on its own

  // Videos play while they are on screen and stop when they leave.
  var inView = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (e.isIntersecting) play(e.target); else e.target.pause();
    });
  }, { threshold: 0.6 });

  document.querySelectorAll('video').forEach(function (v) {
    if (v.hasAttribute('data-autoplay') || !hoverable) {
      inView.observe(v); // statement frame always; cards on touch screens
    } else {
      var card = v.closest('.card');
      card.addEventListener('mouseenter', function () { play(v); });
      card.addEventListener('focus', function () { play(v); });
      card.addEventListener('mouseleave', function () { v.pause(); });
      card.addEventListener('blur', function () { v.pause(); });
    }
  });
})();
