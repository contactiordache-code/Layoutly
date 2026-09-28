document.documentElement.classList.add('js');

(function () {
  const cfg = window.LAYOUTLY_SITE;
  const ua = navigator.userAgent;
  const os = /Windows/i.test(ua) ? 'windows' : /Mac/i.test(ua) ? 'mac' : null;

  document.querySelectorAll('[data-dl]').forEach((a) => (a.href = cfg.downloads[a.dataset.dl]));

  // The primary "Download" buttons point at the file for the visitor's OS.
  const primary = os === 'windows' ? cfg.downloads.windows : os === 'mac' ? cfg.downloads.macArm : null;
  if (primary) document.querySelectorAll('[data-download-primary]').forEach((a) => (a.href = primary));

  document.querySelectorAll('[data-checkout]').forEach((a) => (a.href = cfg.checkoutUrl));
  document.querySelectorAll('[data-github]').forEach((a) => (a.href = `https://github.com/${cfg.repo}`));
  document.querySelectorAll('[data-x]').forEach((a) => (a.href = cfg.xUrl));
  document.querySelectorAll('[data-price]').forEach((n) => (n.textContent = cfg.price));
  document.getElementById('year').textContent = new Date().getFullYear();

  // Real star count; the "GitHub" label stays if the repo is private or the API is unreachable.
  const stars = document.querySelectorAll('[data-github-stars]');
  fetch(`https://api.github.com/repos/${cfg.repo}`)
    .then((res) => (res.ok ? res.json() : null))
    .then((repo) => {
      const n = repo && repo.stargazers_count;
      if (typeof n !== 'number') return;
      const label = n >= 1000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k` : String(n);
      stars.forEach((s) => (s.textContent = label));
    })
    .catch(() => {});
})();

// Dotted double-chevrons inside each button's pill, enough to fill it when it expands on hover.
(function () {
  const dots = [[2, 2, 0], [5, 5, 0.05], [8, 8, 0.1], [5, 11, 0.15], [2, 14, 0.2], [6, 2, 0.05], [9, 5, 0.1], [12, 8, 0.15], [9, 11, 0.2], [6, 14, 0.25]];
  const chevron = (i) =>
    `<svg width="14" height="16" viewBox="0 0 14 16" aria-hidden="true" focusable="false"><g fill="currentColor">${dots
      .map(([cx, cy, d]) => `<circle class="am-dot" cx="${cx}" cy="${cy}" r="1" style="animation-delay:${(i * 0.12 + d).toFixed(2)}s"/>`)
      .join('')}</g></svg>`;
  const fill = () => {
    document.querySelectorAll('.am-accent').forEach((pill) => {
      const width = pill.parentElement.offsetWidth;
      const count = width ? Math.ceil((width - 12) / 24) : 6;
      if (pill.childElementCount === count) return;
      pill.innerHTML = Array.from({ length: count }, (_, i) => chevron(i)).join('');
    });
  };
  fill();
  window.addEventListener('resize', fill);
  if (document.fonts) document.fonts.ready.then(fill);
})();

// Maker card: the + button expands the bio and reveals the X link.
document.querySelectorAll('.pc-toggle').forEach((btn) => {
  btn.addEventListener('click', () => {
    const card = btn.closest('.pc');
    const open = card.classList.toggle('is-open');
    btn.setAttribute('aria-expanded', String(open));
    btn.setAttribute('aria-label', open ? 'Show less' : 'Show more');
    card.querySelectorAll('.pc-preview').forEach((link) => (link.tabIndex = open ? 0 : -1));
  });
});

// Mobile menu.
(function () {
  const toggle = document.querySelector('.nav-toggle');
  const menu = document.getElementById('nav-menu');
  if (!toggle || !menu) return;
  const setOpen = (open) => {
    menu.hidden = !open;
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  };
  toggle.addEventListener('click', () => setOpen(menu.hidden));
  menu.addEventListener('click', (e) => {
    if (e.target.closest('a')) setOpen(false);
  });
})();

// Slide the footer wordmark up once it scrolls into view.
(function () {
  const items = document.querySelectorAll('.reveal');
  if (!('IntersectionObserver' in window)) {
    items.forEach((el) => el.classList.add('is-visible'));
    return;
  }
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        io.unobserve(entry.target);
      });
    },
    { threshold: 0 }
  );
  items.forEach((el) => io.observe(el));
})();

// How it works: each step plays as it scrolls in. Side by side they enter together
// and CSS chains them press → pick → paste; stacked, each plays on arrival.
(function () {
  const steps = document.querySelectorAll('[data-steps] .step');
  const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (still || !('IntersectionObserver' in window)) {
    steps.forEach((step) => step.classList.add('is-in'));
    return;
  }
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-in');
        io.unobserve(entry.target);
      });
    },
    { threshold: 0.5 }
  );
  steps.forEach((step) => io.observe(step));
})();
