/**
 * main.js — Application entry point.
 * Imports all modules and sets up global event delegation.
 */

import { showPage, requireAuth }  from './router.js';
import { updateAuthUI, doLogin, doRegister, doLogout, getAuthToken } from './auth.js';
import { loadEvents, doCreateEvent, getEvents, doDeleteEvent } from './events.js';
import { openFeedback, setRating, setNPS, toggleChip, submitFeedback, updateProgress, updateRange, initFeedbackListeners } from './feedback.js';
import { switchTab, startDashboardPoll, stopDashboardPoll } from './dashboard.js';
import { downloadReport, copyReport } from './report.js';
import { historyPrev, historyNext, initHistoryListeners } from './history.js';
import { initScrollAnimation, initGlobalLoader }  from './ui.js';

// ── Global Event Delegation ─────────────────────────────────────────────────
// Instead of inline onclick handlers, we use data-action attributes
// and a single click listener on the document body.

document.addEventListener('click', (e) => {
  const target = e.target.closest('[data-action]');
  if (!target) return;

  const action = target.dataset.action;

  switch (action) {
    // Navigation
    case 'go-home':        showPage('index.html'); break;
    case 'go-about':       showPage('about.html'); break;
    case 'go-dashboard':   requireAuth('dashboard.html'); break;
    case 'go-reports':     requireAuth('reports.html'); break;
    case 'go-history':     requireAuth('history.html'); break;
    case 'go-login':       showPage('login.html'); break;
    case 'go-register':    showPage('register.html'); break;
    case 'go-feedback':    showPage('feedback.html'); break;
    case 'go-create-event': showPage('dashboard.html'); break;
    case 'go-report':      showPage('reports.html'); break;
    case 'go-back-landing':    showPage('index.html'); break;
    case 'go-back-dashboard':  showPage('dashboard.html'); break;

    // Auth
    case 'login':    doLogin(); break;
    case 'register': doRegister(); break;
    case 'logout':   stopDashboardPoll(); doLogout(); break;

    // Create Event Modal
    case 'open-create-event': {
      const modal = document.getElementById('create-event-modal');
      if (modal) modal.classList.remove('hidden');
      break;
    }
    case 'close-create-event': {
      const modal = document.getElementById('create-event-modal');
      if (modal) modal.classList.add('hidden');
      break;
    }

    // Feedback form
    case 'submit-feedback':     submitFeedback(); break;
    case 'submit-feedback-nav': {
      const events = getEvents();
      if (events.length) openFeedback(events[0]._id);
      else showPage('feedback.html');
      break;
    }
    case 'open-feedback': {
      const eventId = target.dataset.eventId;
      if (eventId) openFeedback(eventId);
      break;
    }

    // Stars
    case 'set-rating': {
      const val = parseInt(target.dataset.value);
      if (val) setRating(val);
      break;
    }

    // NPS
    case 'set-nps': {
      const val = parseInt(target.dataset.value);
      if (val) setNPS(target, val);
      break;
    }

    // Chips
    case 'toggle-chip': {
      toggleChip(target);
      // Update aria-pressed for accessibility
      target.setAttribute('aria-pressed', target.classList.contains('active') ? 'true' : 'false');
      break;
    }

    // Dashboard tabs
    case 'switch-tab': {
      const panel = target.dataset.panel;
      if (panel) switchTab(target, panel);
      break;
    }

    // Events
    case 'create-event': doCreateEvent(); break;
    case 'delete-event': {
      const eventId = target.dataset.eventId;
      if (eventId) doDeleteEvent(eventId, target);
      break;
    }

    // Reports
    case 'download-report': downloadReport(); break;
    case 'copy-report':     copyReport(); break;

    // History pagination
    case 'history-prev': historyPrev(); break;
    case 'history-next': historyNext(); break;

    // Mobile menu
    case 'toggle-mobile-menu': {
      const menu = document.getElementById('mobile-menu');
      const btn  = document.getElementById('hamburger-btn');
      if (menu) menu.classList.toggle('open');
      if (btn)  btn.setAttribute('aria-expanded', menu?.classList.contains('open') ? 'true' : 'false');
      break;
    }
  }
});

// Handle Enter key on login/register password fields
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter') return;
  if (e.target.id === 'login-password') doLogin();
  if (e.target.id === 'reg-password') doRegister();
});

// Content slider input handler
const slider = document.getElementById('content-slider');
if (slider) {
  slider.addEventListener('input', () => updateRange(slider, 'content-val'));
}

// ── Initialization ──────────────────────────────────────────────────────────

(async () => {
  // Global Loader
  initGlobalLoader();

  // Restore nav UI from stored session
  updateAuthUI();

  // Initialize form listeners
  initFeedbackListeners();
  initHistoryListeners();

  // Load events from API (public endpoint)
  await loadEvents();

  // Initialize scroll animation
  initScrollAnimation();

  // Start dashboard auto-refresh if on dashboard page
  if (window.location.pathname.includes('dashboard')) {
    const { updateDashboard } = await import('./dashboard.js');
    await updateDashboard();
    startDashboardPoll();
  }

  // Update hero card if logged in
  if (getAuthToken()) {
    const { updateHeroCard } = await import('./events.js');
    updateHeroCard();
  }
})();
