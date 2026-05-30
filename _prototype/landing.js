/* UTONOMA — landing interactions (anime.js) */
(function () {
  'use strict';
  var hasAnime = typeof anime !== 'undefined';
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- number counters ---------- */
  function fmt(n, dec) {
    return n.toLocaleString('es-MX', { minimumFractionDigits: dec, maximumFractionDigits: dec });
  }
  function runCounter(el) {
    if (el.dataset.done) return;
    el.dataset.done = '1';
    var target = parseFloat(el.dataset.count);
    var dec = parseInt(el.dataset.decimals || '0', 10);
    var suffix = el.dataset.suffix || '';
    var prefix = el.dataset.prefix || '';
    if (!hasAnime || reduce) { el.textContent = prefix + fmt(target, dec) + suffix; return; }
    var obj = { v: 0 };
    anime({
      targets: obj, v: target, duration: 1500, easing: 'easeOutExpo',
      round: dec === 0 ? 1 : 0,
      update: function () { el.textContent = prefix + fmt(obj.v, dec) + suffix; }
    });
  }

  /* ---------- reveal on scroll (with per-group stagger) ---------- */
  var revealObs = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (!e.isIntersecting) return;
      var el = e.target;
      var sibs = Array.prototype.filter.call(el.parentElement.children, function (c) { return c.classList.contains('reveal'); });
      var idx = sibs.indexOf(el);
      el.style.transitionDelay = Math.max(0, idx) * 75 + 'ms';
      el.classList.add('in');
      revealObs.unobserve(el);
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
  document.querySelectorAll('.reveal').forEach(function (el) { revealObs.observe(el); });

  /* ---------- counters trigger ---------- */
  var countObs = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (e.isIntersecting) { runCounter(e.target); countObs.unobserve(e.target); }
    });
  }, { threshold: 0.6 });
  document.querySelectorAll('[data-count]').forEach(function (el) { countObs.observe(el); });

  /* ---------- hero entrance ---------- */
  function heroIn() {
    if (!hasAnime || reduce) {
      document.querySelectorAll('.hero-word').forEach(function (w) { w.style.opacity = 1; });
      return;
    }
    anime.timeline()
      .add({
        targets: '.hero-word',
        translateY: [28, 0], opacity: [0, 1],
        duration: 760, delay: anime.stagger(55), easing: 'easeOutExpo'
      })
      .add({
        targets: '.phone', translateY: [40, 0], opacity: [0, 1], scale: [0.96, 1],
        duration: 900, easing: 'easeOutExpo'
      }, '-=600');
  }

  /* ---------- floating loops ---------- */
  function floats() {
    if (!hasAnime || reduce) return;
    anime({ targets: '#phone', translateY: [0, -14], direction: 'alternate', loop: true, duration: 3200, easing: 'easeInOutSine' });
    anime({ targets: '.float-card.fc1', translateY: [0, -18], direction: 'alternate', loop: true, duration: 2600, easing: 'easeInOutSine', delay: 200 });
    anime({ targets: '.float-card.fc2', translateY: [0, 16], direction: 'alternate', loop: true, duration: 3000, easing: 'easeInOutSine', delay: 500 });
    anime({ targets: '.atmos .g1', translateX: [-20, 30], translateY: [0, 24], direction: 'alternate', loop: true, duration: 9000, easing: 'easeInOutSine' });
    anime({ targets: '.atmos .g2', translateX: [0, -28], translateY: [0, -18], direction: 'alternate', loop: true, duration: 11000, easing: 'easeInOutSine' });
  }

  /* ---------- credit card pointer tilt ---------- */
  var credit = document.getElementById('credit');
  if (credit && !reduce) {
    var stage = credit.parentElement;
    stage.style.perspective = '900px';
    credit.style.transition = 'transform .2s ease';
    stage.addEventListener('mousemove', function (ev) {
      var r = credit.getBoundingClientRect();
      var px = (ev.clientX - r.left) / r.width - 0.5;
      var py = (ev.clientY - r.top) / r.height - 0.5;
      credit.style.transform = 'rotateY(' + (px * 12) + 'deg) rotateX(' + (-py * 12) + 'deg)';
    });
    stage.addEventListener('mouseleave', function () { credit.style.transform = 'rotateY(0) rotateX(0)'; });
  }

  /* ---------- FAQ accordion ---------- */
  document.querySelectorAll('.faq').forEach(function (faq) {
    var q = faq.querySelector('.faq-q');
    var a = faq.querySelector('.faq-a');
    q.addEventListener('click', function () {
      var open = faq.classList.contains('open');
      document.querySelectorAll('.faq.open').forEach(function (f) {
        f.classList.remove('open'); f.querySelector('.faq-a').style.maxHeight = null;
      });
      if (!open) { faq.classList.add('open'); a.style.maxHeight = a.scrollHeight + 'px'; }
    });
  });

  /* ---------- nav: hide on scroll down, show on scroll up ---------- */
  var nav = document.getElementById('nav');
  if (nav) {
    var lastY = window.scrollY;
    var ticking = false;
    function onScroll() {
      var y = window.scrollY;
      nav.classList.toggle('nav-scrolled', y > 24);
      // always show near the very top
      if (y < 120) {
        nav.classList.remove('nav-hidden');
      } else if (y > lastY + 6) {
        nav.classList.add('nav-hidden');   // scrolling down
      } else if (y < lastY - 6) {
        nav.classList.remove('nav-hidden'); // scrolling up
      }
      lastY = y;
      ticking = false;
    }
    window.addEventListener('scroll', function () {
      if (!ticking) { window.requestAnimationFrame(onScroll); ticking = true; }
    }, { passive: true });
  }

  /* ---------- nav anchor smooth (native via CSS) + run ---------- */
  window.addEventListener('load', function () { heroIn(); floats(); });
  if (document.readyState === 'complete') { heroIn(); floats(); }
})();
