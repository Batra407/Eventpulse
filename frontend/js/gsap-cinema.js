/**
 * gsap-cinema.js — Cinematic motion system for EventPulse landing page.
 *
 * KEY FIXES:
 * 1. Uses gsap.from() for hero — elements visible by default, no flash
 * 2. info-cards handled ONLY by reveal-stagger (not separately too)
 * 3. reveal-stagger checks if in viewport to animate immediately vs on scroll
 * 4. No conflicting double-animation on same elements
 */

/* ── 1. Plugin Registration ──────────────────────────────────── */
gsap.registerPlugin(ScrollTrigger);

gsap.defaults({ ease: 'power3.out' });

const qs  = (sel) => document.querySelector(sel);
const qsa = (sel) => [...document.querySelectorAll(sel)];

/* ══════════════════════════════════════════════════════════════
   REDUCED MOTION GUARD
   ══════════════════════════════════════════════════════════════ */
const mm = gsap.matchMedia();

mm.add('(prefers-reduced-motion: no-preference)', () => {

  /* ── 2. Hero Entrance Timeline ─────────────────────────────── */
  const heroCard = qs('.hero-preview-card');

  // Pause CSS float — GSAP takes over after entrance
  if (heroCard) heroCard.style.animationPlayState = 'paused';

  const heroTL = gsap.timeline({
    defaults: { ease: 'power3.out' },
    delay: 0.05,
    onComplete: () => {
      if (heroCard) {
        heroCard.style.animation = 'none';
        gsap.to(heroCard, { y: -10, repeat: -1, yoyo: true, duration: 3.6, ease: 'sine.inOut' });
      }
    }
  });

  // gsap.from() — elements stay visible in CSS by default (no flash if GSAP loads slowly)
  heroTL
    .from('.hero-eyebrow',  { autoAlpha: 0, y: 28, duration: 0.5 })
    .from('.hero-title',    { autoAlpha: 0, y: 36, duration: 0.72 }, '-=0.25')
    .from('.hero-subtitle', { autoAlpha: 0, y: 24, duration: 0.6  }, '-=0.40')
    .from('.hero-actions',  { autoAlpha: 0, y: 20, duration: 0.5  }, '-=0.38')
    .from('.hero-trust',    { autoAlpha: 0, y: 16, duration: 0.45 }, '-=0.32');

  if (heroCard) {
    heroTL.from(heroCard, {
      autoAlpha: 0, y: 48, scale: 0.94,
      duration: 0.85, ease: 'back.out(1.4)'
    }, '-=0.85');
  }

  /* ── 3. Blob Parallax — adds to CSS drift animation on scroll ── */
  [
    { sel: '.bg-blob-1', yPercent: -15 },
    { sel: '.bg-blob-2', yPercent:  12 },
    { sel: '.bg-blob-3', yPercent:  -9 }
  ].forEach(({ sel, yPercent }) => {
    const el = qs(sel);
    if (!el) return;
    gsap.to(el, {
      yPercent, ease: 'none',
      scrollTrigger: { trigger: 'body', start: 'top top', end: 'bottom bottom', scrub: 2 }
    });
  });

  // Stats Strip is securely handled by generic .reveal-stagger block below. No duplicate code.

  /* ── 5. Scroll Reveal: .reveal + .reveal-stagger ────────────── */
  // NOTE: .info-card elements are children of a .reveal-stagger div.
  // They are handled here — do NOT add a separate info-card handler.

  // .reveal — individual elements
  const revealEls = qsa('.reveal').filter(el => !el.closest('.reveal-stagger'));
  revealEls.forEach(el => {
    gsap.set(el, { opacity: 0, y: 24 });
    if (el.getBoundingClientRect().top < window.innerHeight) {
      gsap.to(el, { opacity: 1, y: 0, duration: 0.6, ease: 'power3.out', delay: 0.3 });
    } else {
      ScrollTrigger.create({
        trigger: el, start: 'top 90%', once: true,
        onEnter: () => gsap.to(el, { opacity: 1, y: 0, duration: 0.6, ease: 'power3.out' })
      });
    }
  });

  // .reveal-stagger — animate children of each container
  qsa('.reveal-stagger').forEach((container) => {
    const children = [...container.children];
    if (!children.length) return;

    // Hide children first
    gsap.set(children, { opacity: 0, y: 24 });

    const containerRect = container.getBoundingClientRect();
    const alreadyVisible = containerRect.top < window.innerHeight;

    if (alreadyVisible) {
      // Already on screen — animate after hero entrance (delay 0.7s)
      gsap.to(children, {
        opacity: 1, y: 0, duration: 0.65,
        stagger: { each: 0.1 }, ease: 'power3.out',
        delay: 0.7
      });
    } else {
      // Below fold — trigger on scroll
      ScrollTrigger.create({
        trigger: container, start: 'top 90%', once: true,
        onEnter: () => gsap.to(children, {
          opacity: 1, y: 0, duration: 0.65,
          stagger: { each: 0.1 }, ease: 'power3.out'
        })
      });
    }
  });

  // Events Section is handled by the regular .reveal class below.

  /* ── 7. Event Cards (dynamically populated by JS after API) ─── */
  const eventsGrid = qs('#events-grid');
  if (eventsGrid) {
    const revealEventCards = () => {
      const cards = qsa('#events-grid .event-card');
      if (!cards.length) return;
      gsap.from(cards, {
        autoAlpha: 0, y: 28, duration: 0.55,
        stagger: { each: 0.1 }, ease: 'power3.out', delay: 0.1
      });
    };
    new MutationObserver((muts) => {
      if (muts.some(m => m.addedNodes.length)) revealEventCards();
    }).observe(eventsGrid, { childList: true });
  }

  /* ── 8. Navbar scroll state ─────────────────────────────────── */
  const navbar = qs('.navbar');
  if (navbar) {
    ScrollTrigger.create({
      start: 'top -60',
      onUpdate: (self) => navbar.classList.toggle('scrolled', self.scroll() > 60)
    });
  }

  /* ── 9. Spotlight pulse ─────────────────────────────────────── */
  const spotlight = qs('.hero-spotlight');
  if (spotlight) {
    gsap.fromTo(spotlight,
      { opacity: 0.5, scale: 0.92 },
      { opacity: 0.85, scale: 1.06, repeat: -1, yoyo: true, duration: 4.5, ease: 'sine.inOut' }
    );
  }

  /* ── 10. Button hover micro-glow ────────────────────────────── */
  qsa('.btn-primary').forEach((btn) => {
    btn.addEventListener('mouseenter', () => {
      gsap.to(btn, { scale: 1.035, duration: 0.22, ease: 'power2.out', overwrite: 'auto' });
    });
    btn.addEventListener('mouseleave', () => {
      gsap.to(btn, { scale: 1, duration: 0.28, ease: 'power3.out', overwrite: 'auto' });
    });
  });

  return () => { ScrollTrigger.getAll().forEach(t => t.kill()); };

}); // end matchMedia no-preference
