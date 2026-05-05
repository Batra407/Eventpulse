/**
 * router.js — Multi-page routing and auth guards.
 *
 * NOTE: updateDashboard / updateReport / renderHistory are loaded via
 * dynamic import() inside DOMContentLoaded to avoid circular-module
 * issues (those modules also import from router.js).
 */

import { getSession } from './auth.js';

const PROTECTED_PAGES = ['dashboard.html', 'reports.html', 'history.html'];

export async function requireAuth(targetUrl) {
  const session = await getSession();
  if (session) {
    if (targetUrl) window.location.href = targetUrl;
  } else {
    window.location.href = '/login.html';
  }
}

export function showPage(url) {
  window.location.href = url;
}

// Check auth immediately on load
const path = window.location.pathname;
const isProtected = PROTECTED_PAGES.some(p => path.endsWith(p));

if (isProtected) {
  getSession().then(session => {
    if (!session) window.location.href = '/login.html';
  });
}

/** Scroll handler — adds shadow to the navbar when page is scrolled */
window.addEventListener('scroll', () => {
  const nav = document.getElementById('main-nav');
  if (nav) nav.classList.toggle('scrolled', window.scrollY > 10);
});

// Update active nav pill based on current URL and trigger data loaders
document.addEventListener('DOMContentLoaded', () => {
  const currentPath = window.location.pathname;

  // Highlight active nav pill
  document.querySelectorAll('.nav-pill').forEach(pill => {
    pill.classList.remove('active');
    const href = pill.getAttribute('href');
    if (href && currentPath.endsWith(href)) {
      pill.classList.add('active');
    } else if ((currentPath.endsWith('/') || currentPath.endsWith('index.html')) && href === 'index.html') {
      pill.classList.add('active');
    }
  });

  // Trigger page-specific data loaders via dynamic import to avoid circular deps
  if (currentPath.endsWith('dashboard.html')) {
    import('./dashboard.js').then(({ updateDashboard }) => updateDashboard());
  } else if (currentPath.endsWith('reports.html')) {
    import('./report.js').then(({ updateReport }) => updateReport());
  } else if (currentPath.endsWith('history.html')) {
    import('./history.js').then(({ renderHistory }) => renderHistory());
  } else if (currentPath.endsWith('index.html') || currentPath.endsWith('/')) {
    import('./auth.js').then(({ getSession }) => {
      getSession().then(session => {
        if (session) {
          import('./events.js').then(({ updateHeroCard }) => updateHeroCard());
        }
      });
    });
  }
});

// Make globally available for any remaining inline needs
window.showPage = showPage;
window.requireAuth = requireAuth;
