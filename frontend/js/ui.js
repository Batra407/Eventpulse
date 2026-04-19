/**
 * ui.js — Shared UI utility functions + premium motion system.
 * Exports: shakeEl, debounce, formatDate, escapeHtml,
 *          skeletonTableRows, skeletonKPIs,
 *          countUp, initScrollReveal, initHeroTilt, initActivityPulse
 */

/* ── Basic Utilities ─────────────────────────────────────────── */

/**
 * Briefly highlights an element with a red outline to indicate a validation error.
 */
export function shakeEl(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.add('shake-error');
  el.style.outline = '2px solid var(--danger)';
  setTimeout(() => {
    el.style.outline = '';
    el.classList.remove('shake-error');
  }, 800);
}

/**
 * Debounce wrapper — delays execution until input stops.
 */
export function debounce(fn, ms = 300) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

/**
 * Format a date string into a human-readable format.
 */
export function formatDate(date) {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Escape HTML characters to prevent XSS in dynamic content.
 */
export function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/**
 * Generate skeleton loading HTML for a table.
 */
export function skeletonTableRows(rows = 5, cols = 6) {
  return Array.from({ length: rows }, () => `
    <tr class="skeleton-row">
      ${Array.from({ length: cols }, () => `
        <td><div class="skeleton skeleton-text"></div></td>
      `).join('')}
    </tr>
  `).join('');
}

/**
 * Generate skeleton loading HTML for KPI cards.
 */
export function skeletonKPIs() {
  return Array.from({ length: 4 }, () => `
    <div class="kpi-card skeleton-card">
      <div class="skeleton skeleton-icon"></div>
      <div class="skeleton skeleton-value"></div>
      <div class="skeleton skeleton-label"></div>
    </div>
  `).join('');
}

/* ── Count-Up Animation ──────────────────────────────────────── */

/**
 * Animates a numeric value counting up from 0 (or current) to target.
 * Respects prefers-reduced-motion.
 *
 * @param {HTMLElement} el       - The element whose textContent to animate
 * @param {number}      target   - The final numeric value
 * @param {number}      duration - Duration in ms (default 1100)
 * @param {string}      suffix   - Text appended after number (e.g. ' / 5')
 * @param {number}      decimals - Decimal places to show (default 0)
 */
export function countUp(el, target, duration = 1100, suffix = '', decimals = 0) {
  if (!el) return;

  // Respect reduced-motion
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced) {
    el.textContent = decimals > 0 ? target.toFixed(decimals) + suffix : target + suffix;
    return;
  }

  const start     = performance.now();
  const startVal  = 0;

  // Easing: ease-out cubic
  function ease(t) { return 1 - Math.pow(1 - t, 3); }

  function tick(now) {
    const elapsed  = now - start;
    const progress = Math.min(elapsed / duration, 1);
    const current  = startVal + (target - startVal) * ease(progress);
    el.textContent = decimals > 0
      ? current.toFixed(decimals) + suffix
      : Math.round(current) + suffix;

    if (progress < 1) requestAnimationFrame(tick);
  }

  requestAnimationFrame(tick);
}

/* ── Scroll Reveal ───────────────────────────────────────────── */

/**
 * Initializes IntersectionObserver-based scroll reveal for elements
 * with class 'reveal' or 'reveal-stagger'.
 * Safe on mobile (CSS falls back to visible).
 */
export function initScrollReveal() {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced) return; // CSS also handles this, belt+suspenders

  const targets = document.querySelectorAll('.reveal, .reveal-stagger');
  if (!targets.length) return;

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target); // fire once
        }
      });
    },
    { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
  );

  targets.forEach((el) => observer.observe(el));
}

/* ── Hero 3D Tilt ────────────────────────────────────────────── */

/**
 * Adds a subtle 3D tilt effect (±4°) to the hero preview card
 * based on mouse position within .hero-right.
 * Card floats back on mouse leave.
 */
export function initHeroTilt() {
  const trigger = document.querySelector('.hero-right');
  const card    = document.querySelector('.hero-preview-card');
  if (!trigger || !card) return;

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced) return;

  const MAX_TILT = 4; // degrees

  trigger.addEventListener('mousemove', (e) => {
    const rect   = trigger.getBoundingClientRect();
    const cx     = rect.left + rect.width  / 2;
    const cy     = rect.top  + rect.height / 2;
    const dx     = (e.clientX - cx) / (rect.width  / 2); // -1 to 1
    const dy     = (e.clientY - cy) / (rect.height / 2); // -1 to 1
    const rotateY = +(dx * MAX_TILT).toFixed(2);
    const rotateX = -(dy * MAX_TILT).toFixed(2);

    card.classList.add('tilting');
    card.style.transform = `perspective(900px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(0px)`;
    card.style.boxShadow = `${rotateY * 2}px ${rotateX * -2}px 40px rgba(29,78,216,0.15), 0 20px 60px rgba(10,15,30,0.12)`;
  });

  trigger.addEventListener('mouseleave', () => {
    card.classList.remove('tilting');
    card.style.transform = '';
    card.style.boxShadow = '';
  });
}

/* ── Activity Pulse (hero preview) ──────────────────────────── */

/**
 * Simulates a "live" product feel by briefly flashing a random
 * preview-item in the hero card every 8–16 seconds.
 * Non-intrusive — only visible on hover focus.
 */
export function initActivityPulse() {
  const items = document.querySelectorAll('.preview-item');
  if (items.length === 0) return;

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced) return;

  function flashRandom() {
    const idx  = Math.floor(Math.random() * items.length);
    const item = items[idx];
    item.classList.remove('flashing');
    // Force reflow so animation restarts
    void item.offsetWidth;
    item.classList.add('flashing');
    item.addEventListener('animationend', () => item.classList.remove('flashing'), { once: true });
  }

  // Initial delay then repeat
  const schedule = () => {
    const delay = 8000 + Math.random() * 8000; // 8–16s
    setTimeout(() => { flashRandom(); schedule(); }, delay);
  };
  setTimeout(schedule, 3000); // first pulse after 3s page load
}

/* ── Scroll Animation (legacy SPA) ──────────────────────────── */

/**
 * Initialize the scroll-driven 3D animation on the landing page.
 * Kept for backward compat with router.js.
 */
export function initScrollAnimation() {
  const section  = document.getElementById('scroll-anim-section');
  const cardWrap = document.getElementById('scroll-card-wrap');
  const titleEl  = document.getElementById('scroll-anim-title');

  if (!section || !cardWrap || !titleEl) return;

  const isMobile = () => window.innerWidth <= 768;

  function mapRange(value, inMin, inMax, outMin, outMax) {
    const clamped = Math.min(Math.max(value, inMin), inMax);
    return outMin + ((clamped - inMin) / (inMax - inMin)) * (outMax - outMin);
  }

  function onScroll() {
    const rect     = section.getBoundingClientRect();
    const navH     = 64;
    const total    = section.offsetHeight - (window.innerHeight - navH);
    const scrolled = -rect.top + navH;
    const progress = Math.min(Math.max(scrolled / total, 0), 1);

    const rotate     = mapRange(progress, 0, 1, 20, 0);
    const scaleFrom  = isMobile() ? 0.7 : 1.05;
    const scaleTo    = isMobile() ? 0.9 : 1.0;
    const scale      = mapRange(progress, 0, 1, scaleFrom, scaleTo);
    const translateY = mapRange(progress, 0, 1, 0, -100);

    cardWrap.style.transform = `rotateX(${rotate}deg) scale(${scale})`;
    titleEl.style.transform  = `translateY(${translateY}px)`;
  }

  let listening = false;
  window._scrollAnimCheck = () => {
    const landing = document.getElementById('landing');
    if (landing && landing.classList.contains('active')) {
      if (!listening) {
        window.addEventListener('scroll', onScroll, { passive: true });
        onScroll();
        listening = true;
      }
    } else if (listening) {
      window.removeEventListener('scroll', onScroll);
      listening = false;
    }
  };

  window._scrollAnimCheck();
}
