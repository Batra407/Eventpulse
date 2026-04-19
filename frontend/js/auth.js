/**
 * auth.js — Authentication module.
 * Handles login, register, logout, and nav UI updates.
 */

import { apiFetch }    from './api.js';
import { showPage }    from './router.js';
import { toastSuccess, toastError, toastInfo } from './toast.js';

// ── State ───────────────────────────────────────────────────────────────────

/** Get the current auth token */
export function getAuthToken() {
  return localStorage.getItem('ep_token');
}

/** Get the current organizer info */
export function getOrganizer() {
  return JSON.parse(localStorage.getItem('ep_organizer') || 'null');
}

/** Persist auth session */
function saveAuth(token, organizer) {
  localStorage.setItem('ep_token', token);
  localStorage.setItem('ep_organizer', JSON.stringify(organizer));
  updateAuthUI();
}

/** Clear auth state */
function clearAuth() {
  localStorage.removeItem('ep_token');
  localStorage.removeItem('ep_organizer');
  updateAuthUI();
}

// ── Nav UI ──────────────────────────────────────────────────────────────────

/**
 * Update the nav bar to reflect the current auth state.
 */
export function updateAuthUI() {
  const area = document.getElementById('nav-auth-area');
  if (!area) return;

  const token = getAuthToken();
  const org   = getOrganizer();

  if (token && org) {
    area.innerHTML = `
      <div class="navbar-user">
        <span class="navbar-user-dot" aria-hidden="true"></span>
        ${escapeHtml(org.name)}
      </div>
      <button class="btn btn-ghost btn-sm" data-action="logout" style="color:var(--text-3);">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
        Log out
      </button>`;
  } else {
    area.innerHTML = `
      <a href="login.html" class="btn btn-secondary btn-sm">Organizer Login</a>
      <a href="register.html" class="btn btn-primary btn-sm">Get Started</a>`;
  }
}

/** Simple HTML escape for nav output */
function escapeHtml(str) {
  if (!str) return '';
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

// ── Login ───────────────────────────────────────────────────────────────────

export async function doLogin() {
  const email    = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const errEl    = document.getElementById('login-error');
  const btn      = document.getElementById('login-btn');

  errEl.style.display = 'none';

  if (!email || !password) {
    errEl.textContent   = 'Please enter your email and password.';
    errEl.style.display = 'block';
    return;
  }

  btn.disabled = true;
  btn.innerHTML = '<span class="spinner" style="width:14px;height:14px;border-width:2px;"></span> Signing in…';

  try {
    // apiFetch returns { success, message, data: { token, organizer } }
    const res = await apiFetch('/api/auth/login', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ email, password }),
    });
    const { token, organizer } = res.data;

    saveAuth(token, organizer);
    document.getElementById('login-email').value    = '';
    document.getElementById('login-password').value = '';
    toastSuccess(`Welcome back, ${organizer.name}!`);
    window.location.href = '/dashboard.html';
  } catch (e) {
    errEl.textContent   = e.message || 'Login failed.';
    errEl.style.display = 'block';
    toastError(e.message || 'Login failed');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Sign In';
  }
}

// ── Register ────────────────────────────────────────────────────────────────

export async function doRegister() {
  const name     = document.getElementById('reg-name').value.trim();
  const email    = document.getElementById('reg-email').value.trim();
  const password = document.getElementById('reg-password').value;
  const errEl    = document.getElementById('register-error');
  const btn      = document.getElementById('register-btn');

  errEl.style.display = 'none';

  if (!name || !email || !password) {
    errEl.textContent   = 'Please fill in all fields.';
    errEl.style.display = 'block';
    return;
  }

  if (password.length < 6) {
    errEl.textContent   = 'Password must be at least 6 characters.';
    errEl.style.display = 'block';
    return;
  }

  btn.disabled = true;
  btn.innerHTML = '<span class="spinner" style="width:14px;height:14px;border-width:2px;"></span> Creating account…';

  try {
    // apiFetch returns { success, message, data: { token, organizer } }
    const res = await apiFetch('/api/auth/register', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ name, email, password }),
    });
    const { token, organizer } = res.data;

    saveAuth(token, organizer);
    toastSuccess('Account created successfully!');
    window.location.href = '/dashboard.html';
  } catch (e) {
    errEl.textContent   = e.message || 'Registration failed.';
    errEl.style.display = 'block';
    toastError(e.message || 'Registration failed');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Create Account';
  }
}

// ── Logout ──────────────────────────────────────────────────────────────────

export function doLogout() {
  clearAuth();
  toastInfo('Logged out successfully');
  window.location.href = '/index.html';
}
