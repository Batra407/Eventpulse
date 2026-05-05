/**
 * api.js — Centralized API communication layer.
 * Enterprise Refactor: Automatic /api/v1 routing, Idempotency Keys, Traceability, Offline Retry.
 */

export const API = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
  ? 'http://localhost:5000'
  : window.location.origin;

/**
 * Generate a v4 UUID for trace IDs and idempotency keys
 */
function uuidv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Wrapper around fetch() with Enterprise features:
 *  - Auto /v1 routing
 *  - Idempotency & Trace IDs
 *  - Offline detection
 *  - 10-second AbortController timeout
 */
export async function apiFetch(path, options = {}) {
  if (!navigator.onLine) {
    throw new Error('You appear to be offline. Please check your connection and try again.');
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);

  const headers = { ...(options.headers || {}) };

  // Add API Versioning transparently
  let finalPath = path;
  if (path.startsWith('/api/') && !path.startsWith('/api/v1/')) {
    finalPath = path.replace('/api/', '/api/v1/');
  }

  // Traceability
  headers['X-Trace-Id'] = uuidv4();

  // Idempotency (only for mutations)
  const method = (options.method || 'GET').toUpperCase();
  if (['POST', 'PUT', 'DELETE'].includes(method)) {
    headers['X-Idempotency-Key'] = uuidv4();
  }

  // Auth headers for attendees/users (Organizers use HttpOnly cookies)
  const userToken = localStorage.getItem('ep_user_token');
  if (userToken) {
    headers['Authorization'] = `Bearer ${userToken}`;
  }

  try {
    const res = await fetch(`${API}${finalPath}`, {
      ...options,
      headers,
      credentials: 'include',
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (res.status === 401 || res.status === 403) {
      // Read the actual server error message before deciding what to do
      let serverMessage = 'Session expired or access denied — please log in again';
      try {
        const errBody = await res.json();
        if (errBody && errBody.message) serverMessage = errBody.message;
      } catch { /* fallback to default */ }

      const currentPath = window.location.pathname;
      const isAuthPage = currentPath.includes('author-login') || currentPath.includes('register') || currentPath.includes('user-login');
      const isPublicPage = currentPath.includes('attendance.html') || currentPath.includes('feedback.html') || currentPath.includes('index.html');

      if (!isAuthPage && !isPublicPage) {
        // Organizer-protected page (dashboard, history, reports): redirect to organizer login
        window.location.href = '/author-login.html';
      }
      // On public pages (feedback, attendance, landing): just surface the error as a message
      // Do NOT redirect — it would break the public feedback experience

      throw new Error(serverMessage);
    }

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      // Standardized error extraction (Phase 19)
      throw new Error(err.message || err.error || `HTTP ${res.status}`);
    }

    return res.json();
  } catch (e) {
    clearTimeout(timer);
    if (e.name === 'AbortError') throw new Error('Request timed out — please check your connection');
    throw e;
  }
}
