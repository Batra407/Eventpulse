/**
 * toast.js — Toast notification system.
 * Matches the new EventPulse design system (simple card with left border).
 */

let toastContainer = null;

function ensureContainer() {
  if (toastContainer) return;
  toastContainer = document.getElementById('toast-container');
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.id = 'toast-container';
    document.body.appendChild(toastContainer);
  }
}

const ICONS = {
  success: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10B981" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>`,
  error:   `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#EF4444" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`,
  info:    `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
  warning: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
};

/**
 * Show a toast notification.
 * @param {string} message - Message to display
 * @param {'success'|'error'|'info'|'warning'} [type='info']
 * @param {number} [duration=4000] - Auto-dismiss in ms
 */
export function showToast(message, type = 'info', duration = 4000) {
  ensureContainer();

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.setAttribute('role', 'alert');
  toast.innerHTML = `
    ${ICONS[type] || ICONS.info}
    <span style="flex:1;">${message}</span>
    <button style="background:none;border:none;cursor:pointer;color:var(--text-4);padding:0;line-height:1;margin-left:4px;" aria-label="Close notification">
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
    </button>
  `;

  toast.querySelector('button').addEventListener('click', () => dismiss(toast));
  toastContainer.appendChild(toast);

  const timer = setTimeout(() => dismiss(toast), duration);
  toast._timer = timer;
}

function dismiss(toast) {
  if (toast._dismissed) return;
  toast._dismissed = true;
  clearTimeout(toast._timer);
  toast.style.opacity = '0';
  toast.style.transform = 'translateX(20px)';
  toast.style.transition = 'opacity 0.2s ease, transform 0.2s ease';
  setTimeout(() => toast.remove(), 200);
}

export const toastSuccess = (msg, dur) => showToast(msg, 'success', dur);
export const toastError   = (msg, dur) => showToast(msg, 'error',   dur);
export const toastInfo    = (msg, dur) => showToast(msg, 'info',    dur);
export const toastWarning = (msg, dur) => showToast(msg, 'warning', dur);
