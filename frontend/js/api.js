/**
 * api.js — Centralized API communication layer.
 * All HTTP calls to the Express backend go through apiFetch().
 */

/** Base URL of the Express API */
const API = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
  ? 'http://localhost:5000'
  : window.location.origin;

/** Get stored auth token */
const getToken = () => localStorage.getItem('ep_token');

/**
 * Wrapper around fetch() that:
 *  - Prepends the base API URL automatically
 *  - Applies an 10-second AbortController timeout
 *  - Automatically attaches the Bearer token if one is stored
 *  - Redirects to login-page on 401 Unauthorized
 *  - Throws a descriptive Error on non-2xx responses
 *
 * @param {string} path      - Endpoint path, e.g. '/api/feedback'
 * @param {RequestInit} [options] - Standard fetch options
 * @returns {Promise<any>}   - Parsed JSON response
 */
export async function apiFetch(path, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);

  const headers = { ...(options.headers || {}) };
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  try {
    const res = await fetch(`${API}${path}`, {
      ...options,
      headers,
      signal: controller.signal,
    });
    clearTimeout(timer);

    // Session expired or invalid token — force re-login
    if (res.status === 401) {
      localStorage.removeItem('ep_token');
      localStorage.removeItem('ep_organizer');
      // Only redirect to login if not already on the login/register pages
      const currentPath = window.location.pathname;
      const isAuthPage = currentPath.endsWith('login.html') || currentPath.endsWith('register.html');
      if (!isAuthPage) {
        window.location.href = '/login.html';
      }
      throw new Error('Session expired — please log in again');
    }

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || err.error || `HTTP ${res.status}`);
    }

    return res.json();
  } catch (e) {
    clearTimeout(timer);
    if (e.name === 'AbortError') {
      throw new Error('Request timed out — please check your connection');
    }
    throw e;
  }
}
