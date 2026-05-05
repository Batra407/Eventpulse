/**
 * auth.js — Organizer authentication module.
 *
 * IMPORTANT: Token storage has been migrated from localStorage to HttpOnly cookies.
 * Cookies are set/cleared by the backend — this file no longer stores tokens.
 *
 * The frontend only:
 *   - Calls backend APIs
 *   - Reacts to backend responses
 *   - Updates UI based on session state
 *
 * All permission decisions are enforced backend-side.
 */

import { apiFetch }    from './api.js';
import { toastSuccess, toastError, toastInfo } from './toast.js';

// ── Session ─────────────────────────────────────────────────────────────────

import { authStore } from './authStore.js';

export async function getSession() {
  return authStore.getOrganizer();
}

// ── Nav UI ──────────────────────────────────────────────────────────────────

export function updateAuthUI(organizer = authStore.getOrganizer()) {
  const area = document.getElementById('nav-auth-area');
  if (!area) return;

  if (organizer) {
    const init = (organizer.name || 'U')[0].toUpperCase();
    area.innerHTML = `
      <a href="dashboard.html" class="flex items-center gap-2 text-black hover:bg-black/5 text-sm font-bold px-4 py-2 rounded-full transition duration-300 ease-in-out">
        <div style="width:26px;height:26px;border-radius:9999px;background:linear-gradient(135deg,#7c3aed,#4f46e5);display:flex;align-items:center;justify-content:center;color:#fff;font-size:0.75rem;font-weight:700;flex-shrink:0">${escapeHtml(init)}</div>
        <span class="hidden sm:inline">${escapeHtml(organizer.name.split(' ')[0])}</span>
      </a>
      <a href="dashboard.html" style="background:linear-gradient(135deg,#7c3aed,#4f46e5);color:#fff;font-weight:700;font-size:0.875rem;padding:10px 20px;border-radius:9999px;border:none;text-decoration:none;transition:opacity .2s" onmouseover="this.style.opacity='.85'" onmouseout="this.style.opacity='1'">Dashboard</a>
      <button data-action="logout" style="border:1px solid #d1d5db;color:#6b7280;font-size:0.875rem;font-weight:600;padding:10px 16px;border-radius:9999px;background:transparent;cursor:pointer;transition:all .2s" onmouseover="this.style.borderColor='#000';this.style.color='#000'" onmouseout="this.style.borderColor='#d1d5db';this.style.color='#6b7280'">Logout</button>`;
  } else {
    area.innerHTML = `
      <a href="author-login.html" style="border:2px solid #000;color:#000;font-weight:700;font-size:0.875rem;padding:10px 20px;border-radius:9999px;background:transparent;text-decoration:none;transition:all .2s" onmouseover="this.style.background='#000';this.style.color='#fff'" onmouseout="this.style.background='transparent';this.style.color='#000'">Organizer Login</a>
      <a href="register.html" style="background:linear-gradient(135deg,#7c3aed,#4f46e5);color:#fff;font-weight:700;font-size:0.875rem;padding:10px 20px;border-radius:9999px;border:none;text-decoration:none;box-shadow:0 4px 14px rgba(124,58,237,.3);transition:opacity .2s" onmouseover="this.style.opacity='.88'" onmouseout="this.style.opacity='1'">Get Started</a>`;
  }
}

function escapeHtml(str) {
  if (!str) return '';
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

// ── Register ─────────────────────────────────────────────────────────────────

export async function doRegister() {
  const name     = document.getElementById('reg-name').value.trim();
  const email    = document.getElementById('reg-email').value.trim();
  const password = document.getElementById('reg-password').value;
  const errEl    = document.getElementById('register-error');
  const btn      = document.getElementById('register-btn');

  errEl.style.display = 'none';

  if (!name || !email || !password) {
    errEl.textContent = 'Please fill in all fields.'; errEl.style.display = 'block'; return;
  }
  if (password.length < 8) {
    errEl.textContent = 'Password must be at least 8 characters.'; errEl.style.display = 'block'; return;
  }

  btn.disabled = true;
  btn.innerHTML = '<span class="spinner" style="width:14px;height:14px;border-width:2px;"></span> Sending code…';

  try {
    await apiFetch('/api/v1/auth/register', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password }),
    });
    toastSuccess('Account created! Awaiting admin approval.');
    window.location.href = '/author-login.html';
  } catch (e) {
    errEl.textContent = e.message || 'Registration failed.'; errEl.style.display = 'block';
    toastError(e.message || 'Registration failed');
  } finally {
    btn.disabled = false; btn.textContent = 'Create Account';
  }
}

// ── Logout ───────────────────────────────────────────────────────────────────

export async function doLogout() {
  try {
    await fetch('/api/v1/auth/logout', { method: 'POST', credentials: 'include' });
  } catch {}
  authStore.logout();
  toastInfo('Logged out successfully');
  if (window.location.pathname.includes('dashboard') || window.location.pathname.includes('reports') || window.location.pathname.includes('history')) {
    window.location.href = '/index.html';
  }
}
