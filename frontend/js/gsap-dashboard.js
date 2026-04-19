/**
 * gsap-dashboard.js — Premium motion system for Dashboard + Report pages.
 *
 * Architecture:
 *  - Dashboard: MutationObserver waits for KPI cards + AI panel injection,
 *    then runs GSAP entrance timelines + persistent micro-interactions.
 *  - Report:    Sequential reveal timeline + typing effect on AI summary.
 *  - Shared:    Button hover, card hover, input focus glow.
 *  - All wrapped in gsap.matchMedia() for prefers-reduced-motion safety.
 */

/* ── Detect which page we're on ──────────────────────────────── */
const IS_DASHBOARD = !!document.getElementById('kpi-grid');
const IS_REPORT    = !!document.getElementById('report-ai-text');

const qs  = (s, ctx = document) => ctx.querySelector(s);
const qsa = (s, ctx = document) => [...ctx.querySelectorAll(s)];

/* ── Shared micro-interaction helpers ────────────────────────── */
function addButtonHovers() {
  qsa('.btn-primary, .btn-secondary').forEach((btn) => {
    btn.addEventListener('mouseenter', () => {
      gsap.to(btn, { scale: 1.04, duration: 0.2, ease: 'power2.out', overwrite: 'auto' });
    });
    btn.addEventListener('mouseleave', () => {
      gsap.to(btn, { scale: 1, duration: 0.25, ease: 'power3.out', overwrite: 'auto' });
    });
    btn.addEventListener('mousedown', () => gsap.to(btn, { scale: 0.97, duration: 0.1, overwrite: 'auto' }));
    btn.addEventListener('mouseup',   () => gsap.to(btn, { scale: 1.04, duration: 0.15, overwrite: 'auto' }));
  });
}

function addKpiCardHovers(cards) {
  const ACCENT_GLOW = {
    'accent-blue':   '0 8px 36px rgba(37,99,235,0.22), 0 2px 8px rgba(37,99,235,0.12)',
    'accent-amber':  '0 8px 36px rgba(245,158,11,0.22), 0 2px 8px rgba(245,158,11,0.12)',
    'accent-green':  '0 8px 36px rgba(5,150,105,0.22),  0 2px 8px rgba(5,150,105,0.12)',
    'accent-purple': '0 8px 36px rgba(124,58,237,0.22), 0 2px 8px rgba(124,58,237,0.12)',
  };
  cards.forEach((card) => {
    const accentClass = [...card.classList].find(c => c.startsWith('accent-'));
    const glow = ACCENT_GLOW[accentClass] || '0 8px 36px rgba(37,99,235,0.18)';
    card.addEventListener('mouseenter', () => {
      gsap.to(card, { y: -6, scale: 1.02, boxShadow: glow, duration: 0.25, ease: 'power2.out', overwrite: 'auto' });
    });
    card.addEventListener('mouseleave', () => {
      gsap.to(card, { y: 0, scale: 1, boxShadow: '0 1px 4px rgba(10,15,30,0.06), 0 2px 8px rgba(10,15,30,0.04)', duration: 0.3, ease: 'power3.out', overwrite: 'auto' });
    });
  });
}

/* ── KPI random flash (live feel) ────────────────────────────── */
function startKpiLivePulse(cards) {
  if (!cards.length) return;
  const pulse = () => {
    const card = cards[Math.floor(Math.random() * cards.length)];
    gsap.fromTo(card,
      { boxShadow: '0 1px 4px rgba(10,15,30,0.06)' },
      {
        boxShadow: '0 0 0 2px rgba(99,102,241,0.35), 0 0 28px rgba(99,102,241,0.28)',
        duration: 0.35, ease: 'power2.out', yoyo: true, repeat: 1,
        onComplete: () => gsap.set(card, { clearProps: 'boxShadow' }),
      }
    );
    // Schedule next pulse 8–12s later
    setTimeout(pulse, 8000 + Math.random() * 4000);
  };
  setTimeout(pulse, 6000 + Math.random() * 4000);
}

/* ── Health ring animation ───────────────────────────────────── */
function animateHealthRing() {
  const arc = document.getElementById('health-ring-arc');
  if (!arc) return;
  const total = 2 * Math.PI * 28;
  const target = parseFloat(arc.style.strokeDashoffset ?? total);
  gsap.fromTo(arc,
    { strokeDashoffset: total },
    { strokeDashoffset: target, duration: 1.4, ease: 'power3.out', delay: 0.3 }
  );
}

/* ── Sentiment bars animation ────────────────────────────────── */
function animateSentimentBars() {
  document.querySelectorAll('.sentiment-fill').forEach((bar) => {
    const target = parseFloat(bar.dataset.pct || 0);
    gsap.fromTo(bar,
      { width: '0%' },
      { width: target + '%', duration: 0.9, ease: 'power3.out', delay: 0.5 }
    );
  });
}

/* ── Rating / category bar animations ───────────────────────── */
function animateRatingBars() {
  const rows = qsa('.rating-bar-fill, .cat-bar-fill');
  rows.forEach((bar, i) => {
    const targetW = bar.style.width;
    bar.style.width = '0%';
    gsap.to(bar, { width: targetW, duration: 0.7, delay: 0.1 + i * 0.07, ease: 'power3.out' });
  });
}

/* ── AI typing effect ────────────────────────────────────────── */
function typeText(el, text, durationMs = 1400) {
  if (!el || !text) return;
  el.textContent = '';
  const chars = [...text]; // spread handles emoji/unicode
  const msPerChar = durationMs / chars.length;
  let i = 0;
  const tick = () => {
    if (i < chars.length) {
      el.textContent += chars[i++];
      setTimeout(() => requestAnimationFrame(tick), msPerChar);
    }
  };
  requestAnimationFrame(tick);
}

/* ════════════════════════════════════════════════════════════════
   DASHBOARD
   ════════════════════════════════════════════════════════════════ */
function initDashboard(ctx) {

  /* 1. Page header entrance */
  gsap.from('.section-header', {
    y: -22, autoAlpha: 0, duration: 0.5, ease: 'power3.out', delay: 0.1,
  });

  addButtonHovers();

  /* 2. KPI cards — watch for injection by dashboard.js */
  const kpiGrid = document.getElementById('kpi-grid');
  if (kpiGrid) {
    const onKPIReady = (cards) => {
      if (cards.some(c => c.classList.contains('skeleton-card'))) return; // skip skeletons

      // Entrance stagger
      gsap.from(cards, {
        y: 32, autoAlpha: 0, duration: 0.55, stagger: 0.12, ease: 'power3.out', delay: 0.08,
        onComplete() {
          addKpiCardHovers(cards);
          startKpiLivePulse(cards);
        },
      });
    };

    // Check already present
    const existing = qsa('.kpi-card', kpiGrid);
    if (existing.length && !existing[0].classList.contains('skeleton-card')) {
      onKPIReady(existing);
    }

    // Watch for real cards replacing skeletons
    const kpiObs = new MutationObserver(() => {
      const cards = qsa('.kpi-card', kpiGrid);
      if (cards.length && !cards[0].classList.contains('skeleton-card')) {
        onKPIReady(cards);
        kpiObs.disconnect();
      }
    });
    kpiObs.observe(kpiGrid, { childList: true, subtree: true });
  }

  /* 3. AI panel — watch for injection by dashboard.js */
  const aiPanel = document.getElementById('panel-ai');
  if (aiPanel) {
    const onAIReady = () => {
      // Panel reveal with blur
      gsap.from(aiPanel, {
        autoAlpha: 0, filter: 'blur(6px)', y: 16,
        duration: 0.65, ease: 'power2.out',
      });
      // Health ring + sentiment bars
      requestAnimationFrame(() => {
        animateHealthRing();
        animateSentimentBars();
      });
    };

    const aiObs = new MutationObserver((muts) => {
      if (muts.some(m => m.addedNodes.length)) {
        onAIReady();
        aiObs.disconnect();
      }
    });
    aiObs.observe(aiPanel, { childList: true, subtree: false });
  }

  /* 4. Charts column slide-up */
  const chartsCol = qs('#dash-main-grid > div:last-child');
  if (chartsCol) {
    gsap.from(chartsCol, { y: 28, autoAlpha: 0, duration: 0.65, ease: 'power3.out', delay: 0.45 });
  }

  /* 5. Feedback list — watch for injection */
  const tbody = document.getElementById('feedback-tbody');
  if (tbody) {
    const onFeedbackReady = () => {
      const items = qsa('.list-item', tbody);
      if (!items.length) return;
      gsap.from(items, {
        y: 18, autoAlpha: 0, duration: 0.4, stagger: { each: 0.045, from: 'start' },
        ease: 'power3.out', delay: 0.1,
      });
    };
    const fbObs = new MutationObserver(() => { onFeedbackReady(); fbObs.disconnect(); });
    fbObs.observe(tbody, { childList: true });
  }

  /* 6. Rating bars — watch for injection on #rating-bars-dash */
  const ratingBarsWrap = document.getElementById('rating-bars-dash');
  if (ratingBarsWrap) {
    const rbObs = new MutationObserver(() => {
      animateRatingBars();
      rbObs.disconnect();
    });
    rbObs.observe(ratingBarsWrap, { childList: true });
  }

  /* 7. Tab switch cross-fade — intercept tab clicks */
  document.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const panelId = btn.dataset.panel;
      const panel = document.getElementById(panelId);
      if (!panel) return;
      gsap.fromTo(panel,
        { autoAlpha: 0, y: 10 },
        { autoAlpha: 1, y: 0, duration: 0.3, ease: 'power2.out', overwrite: true }
      );
    });
  });

  /* 8. Live badge micro-pulse on the dot every 2s (CSS, enhanced) */
  const dot = qs('.live-badge-dot');
  if (dot) {
    gsap.to(dot, {
      scale: 1.35, opacity: 1, duration: 0.9, repeat: -1, yoyo: true,
      ease: 'sine.inOut', transformOrigin: 'center',
    });
  }
}

/* ════════════════════════════════════════════════════════════════
   REPORT
   ════════════════════════════════════════════════════════════════ */
function initReport(ctx) {

  addButtonHovers();

  /* Download button glow pulse on hover */
  const dlBtn = document.getElementById('download-report-btn');
  if (dlBtn) {
    dlBtn.addEventListener('mouseenter', () => {
      gsap.to(dlBtn, {
        boxShadow: '0 0 0 3px rgba(29,78,216,0.25), 0 4px 20px rgba(29,78,216,0.32)',
        duration: 0.3, ease: 'power2.out', overwrite: 'auto',
      });
    });
    dlBtn.addEventListener('mouseleave', () => {
      gsap.to(dlBtn, { boxShadow: 'none', duration: 0.35, ease: 'power3.out', overwrite: 'auto' });
    });
  }

  /* Copy button click scale */
  const cpBtn = document.getElementById('copy-report-btn');
  if (cpBtn) {
    cpBtn.addEventListener('click', () => {
      gsap.timeline()
        .to(cpBtn, { scale: 0.92, duration: 0.1, ease: 'power2.in' })
        .to(cpBtn, { scale: 1,    duration: 0.25, ease: 'back.out(2)' });
    });
  }

  /* Sequential section reveal timeline */
  const tl = gsap.timeline({ defaults: { ease: 'power3.out' }, delay: 0.15 });

  const header   = qs('.section-header');
  const kpiCards = qsa('.report-kpi-row .kpi-card');
  const aiCard   = qs('.card:has(#report-ai-text), .card .ai-box')?.closest('.card');
  const sugCard  = qsa('.card')[2]; // suggestions card
  const respCard = qsa('.card')[3]; // responses card

  if (header)   tl.from(header, { y: -20, autoAlpha: 0, duration: 0.4 });

  // KPI cards: alternating left/right slide
  if (kpiCards.length) {
    kpiCards.forEach((card, i) => {
      tl.from(card, {
        x: i % 2 === 0 ? -32 : 32, autoAlpha: 0, duration: 0.45,
      }, i === 0 ? '<0.1' : '<0.12');
    });
    addKpiCardHovers(kpiCards);
  }

  if (aiCard)   tl.from(aiCard,   { y: 22, autoAlpha: 0, duration: 0.5 }, '+=0.05');
  if (sugCard)  tl.from(sugCard,  { y: 22, autoAlpha: 0, duration: 0.45 }, '<0.1');
  if (respCard) tl.from(respCard, { y: 22, autoAlpha: 0, duration: 0.45 }, '<0.1');

  /* AI text typing effect — watch for content injection from report.js */
  const aiTextEl = document.getElementById('report-ai-text');
  if (aiTextEl) {
    const aiObs = new MutationObserver(() => {
      const text = aiTextEl.textContent.trim();
      if (text && text !== 'Loading AI summary…') {
        aiObs.disconnect();
        // Only type if text is short–medium (skip for very long blocks)
        if (text.length < 600) {
          typeText(aiTextEl, text, Math.min(1800, text.length * 28));
        }
      }
    });
    aiObs.observe(aiTextEl, { childList: true, characterData: true, subtree: true });
  }

  /* Response items — watch for injection */
  const respList = document.getElementById('report-responses-list');
  if (respList) {
    const respObs = new MutationObserver(() => {
      const items = qsa('.focus-list-item', respList);
      if (!items.length) return;
      gsap.from(items, {
        y: 18, autoAlpha: 0, duration: 0.38, stagger: { each: 0.055 },
        ease: 'power3.out', delay: 0.1,
      });
      respObs.disconnect();
    });
    respObs.observe(respList, { childList: true });
  }
}

/* ════════════════════════════════════════════════════════════════
   BOOT — gsap.matchMedia for accessibility
   ════════════════════════════════════════════════════════════════ */
const mm = gsap.matchMedia();
mm.add('(prefers-reduced-motion: no-preference)', (ctx) => {
  if (IS_DASHBOARD) initDashboard(ctx);
  if (IS_REPORT)    initReport(ctx);
  return () => { /* cleanup handled by matchMedia */ };
});
