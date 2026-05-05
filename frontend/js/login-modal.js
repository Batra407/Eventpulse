/**
 * login-modal.js — Inline Author Login Modal.
 * No page navigation. Injects a modal overlay into the current page.
 *
 * Usage:
 *   import { openLoginModal } from './login-modal.js';
 *   openLoginModal({ onSuccess: (organizer) => { ... } });
 */

const STYLES = `
#ep-login-overlay {
  position: fixed; inset: 0; z-index: 9999;
  background: rgba(0,0,0,0.45); backdrop-filter: blur(4px);
  display: flex; align-items: center; justify-content: center;
  padding: 16px;
  animation: epFadeIn 0.2s ease;
}
@keyframes epFadeIn { from { opacity:0; } to { opacity:1; } }
@keyframes epSlideUp { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:none; } }
#ep-login-modal {
  background: white; border-radius: 24px; padding: 36px 32px;
  width: 100%; max-width: 420px; box-shadow: 0 24px 80px rgba(0,0,0,0.2);
  animation: epSlideUp 0.25s ease;
  position: relative;
}
.ep-login-logo { display:flex; align-items:center; gap:10px; margin-bottom:24px; }
.ep-login-logo-icon {
  width:36px; height:36px; border-radius:50%;
  background: linear-gradient(135deg,#7c3aed,#4f46e5);
  display:flex; align-items:center; justify-content:center;
}
.ep-login-badge {
  display:inline-flex; align-items:center; gap:6px;
  padding:4px 12px; border-radius:999px;
  background:#ede9fe; color:#7c3aed;
  font-size:11px; font-weight:700; letter-spacing:.06em; text-transform:uppercase;
  margin-bottom:16px;
}
.ep-login-close {
  position:absolute; top:16px; right:16px;
  background:none; border:none; cursor:pointer;
  color:#9ca3af; padding:6px; border-radius:8px;
  transition:background .15s, color .15s;
  line-height:0;
}
.ep-login-close:hover { background:#f3f4f6; color:#111; }
.ep-login-title { font-size:1.4rem; font-weight:800; color:#111; margin-bottom:6px; }
.ep-login-sub { font-size:0.85rem; color:#6b7280; margin-bottom:20px; }
.ep-login-error {
  background:#fef2f2; border:1px solid #fecaca; color:#dc2626;
  padding:10px 14px; border-radius:12px; font-size:13px; font-weight:600;
  margin-bottom:14px; display:none;
}
.ep-login-label { display:block; font-size:13px; font-weight:700; color:#374151; margin-bottom:6px; }
.ep-login-input {
  width:100%; padding:12px 16px; border:2px solid #e5e7eb; border-radius:12px;
  font-size:14px; outline:none; transition:border-color .2s, box-shadow .2s;
  background:#fafafa; box-sizing:border-box; margin-bottom:16px;
}
.ep-login-input:focus { border-color:#7c3aed; box-shadow:0 0 0 3px rgba(124,58,237,.12); background:white; }
.ep-login-btn {
  width:100%; padding:14px; border:none; border-radius:999px;
  background:linear-gradient(135deg,#7c3aed,#4f46e5);
  color:white; font-size:14px; font-weight:700; cursor:pointer;
  transition:transform .2s, box-shadow .2s, opacity .2s;
  box-shadow:0 4px 18px rgba(124,58,237,.35); margin-top:4px;
  display:flex; align-items:center; justify-content:center; gap:8px;
}
.ep-login-btn:hover:not(:disabled) { transform:scale(1.02); box-shadow:0 6px 26px rgba(124,58,237,.45); }
.ep-login-btn:disabled { opacity:.6; cursor:not-allowed; }
.ep-spinner {
  display:inline-block; width:14px; height:14px;
  border:2px solid rgba(255,255,255,.4); border-top-color:white;
  border-radius:50%; animation:epSpin .7s linear infinite;
}
@keyframes epSpin { to { transform:rotate(360deg); } }
`;

function injectStyles() {
  if (document.getElementById('ep-login-styles')) return;
  const s = document.createElement('style');
  s.id = 'ep-login-styles';
  s.textContent = STYLES;
  document.head.appendChild(s);
}

function showToast(msg, color = '#10b981') {
  const t = document.createElement('div');
  t.style.cssText = `position:fixed;bottom:24px;right:24px;z-index:99999;background:white;border-left:4px solid ${color};padding:12px 18px;border-radius:12px;box-shadow:0 8px 30px rgba(0,0,0,.12);font-size:13px;font-weight:600;max-width:300px;color:#111;animation:epSlideUp .25s ease;`;
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 4000);
}

export function openLoginModal({ onSuccess } = {}) {
  injectStyles();

  // Remove any existing modal
  document.getElementById('ep-login-overlay')?.remove();

  const overlay = document.createElement('div');
  overlay.id = 'ep-login-overlay';
  overlay.innerHTML = `
    <div id="ep-login-modal" role="dialog" aria-modal="true" aria-label="Organizer Login">
      <button class="ep-login-close" id="ep-close-btn" aria-label="Close">
        <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>

      <div class="ep-login-logo">
        <div class="ep-login-logo-icon">
          <svg width="14" height="14" fill="none" stroke="white" stroke-width="2.5" viewBox="0 0 24 24"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
        </div>
        <span style="font-weight:800;font-size:1rem;color:#111;">EventPulse</span>
      </div>

      <span class="ep-login-badge">
        <svg width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
        Organizer / Author Login
      </span>

      <div id="ep-step-login">
        <h2 class="ep-login-title">Secure Sign In</h2>
        <p class="ep-login-sub">Enter your email and password to access the dashboard.</p>
        <div id="ep-login-err" class="ep-login-error" role="alert"></div>
        
        <label class="ep-login-label" for="ep-email-in">Organizer Email</label>
        <input class="ep-login-input" id="ep-email-in" type="email" placeholder="you@university.edu" autocomplete="email">
        
        <label class="ep-login-label" for="ep-password-in">Password</label>
        <input class="ep-login-input" id="ep-password-in" type="password" placeholder="••••••••" autocomplete="current-password">
        
        <button class="ep-login-btn" id="ep-login-btn">
          Sign In
          <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
        </button>
        <p style="text-align:center;font-size:12px;color:#9ca3af;margin-top:14px;">
          Not an organizer? <a href="user-login.html" style="color:#7c3aed;font-weight:700;">Sign in as user</a>
        </p>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  // Close on overlay click
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });
  document.getElementById('ep-close-btn').addEventListener('click', closeModal);
  document.addEventListener('keydown', escHandler);

  function closeModal() {
    document.removeEventListener('keydown', escHandler);
    overlay.style.animation = 'epFadeIn .15s ease reverse';
    setTimeout(() => overlay.remove(), 150);
  }

  function escHandler(e) { if (e.key === 'Escape') closeModal(); }

  // ── Error helpers ───────────────────────────────────────────
  function showErr(id, msg) {
    const el = document.getElementById(id);
    el.textContent = msg; el.style.display = 'block';
  }
  function hideErr(id) { document.getElementById(id).style.display = 'none'; }

  // ── Login ───────────────────────────────────────────────────
  const loginBtn = document.getElementById('ep-login-btn');
  const emailIn = document.getElementById('ep-email-in');
  const passIn = document.getElementById('ep-password-in');

  async function doLogin() {
    const email = emailIn.value.trim();
    const pass = passIn.value;
    hideErr('ep-login-err');

    if (!email || !/\S+@\S+\.\S+/.test(email)) {
      showErr('ep-login-err', 'Please enter a valid email address.'); return;
    }
    if (!pass) {
      showErr('ep-login-err', 'Please enter your password.'); return;
    }

    loginBtn.disabled = true;
    loginBtn.innerHTML = '<span class="ep-spinner"></span> Signing in…';
    try {
      const res = await fetch('/api/v1/auth/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        credentials: 'include', // receive HttpOnly cookies
        body: JSON.stringify({ email, password: pass }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || 'Login failed');

      const organizer = json.data || {};
      showToast(\`Welcome, \${organizer.name || 'Organizer'}! 🎉\`);
      closeModal();
      if (onSuccess) onSuccess(organizer);
      else setTimeout(() => { window.location.href = '/dashboard.html'; }, 600);
    } catch (err) {
      showErr('ep-login-err', err.message);
      loginBtn.disabled = false;
      loginBtn.innerHTML = 'Sign In <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>';
    }
  }

  loginBtn.addEventListener('click', doLogin);
  passIn.addEventListener('keydown', (e) => { if (e.key === 'Enter') doLogin(); });

  // Focus email on open
  setTimeout(() => emailIn.focus(), 100);
}
