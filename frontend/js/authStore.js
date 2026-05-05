/**
 * authStore.js — Centralized state management for authentication.
 * Relies on HttpOnly cookies, but uses localStorage to sync state across tabs.
 */

class AuthStore {
  constructor() {
    this.listeners = new Set();
    this.organizer = null;

    // Listen for storage events (from other tabs logging in/out)
    window.addEventListener('storage', (e) => {
      if (e.key === 'session_changed') {
        this.checkState();
      }
    });
  }

  async checkState() {
    try {
      const res = await fetch('/api/v1/auth/me', { credentials: 'include' });
      if (!res.ok) {
        this.organizer = null;
      } else {
        const json = await res.json();
        this.organizer = json.data || null;
      }
    } catch {
      this.organizer = null;
    }
    this.notify();
  }

  login(organizerData) {
    this.organizer = organizerData;
    localStorage.setItem('session_changed', Date.now().toString());
    this.notify();
  }

  logout() {
    this.organizer = null;
    localStorage.setItem('session_changed', Date.now().toString());
    this.notify();
  }

  subscribe(callback) {
    this.listeners.add(callback);
    callback(this.organizer);
    return () => this.listeners.delete(callback);
  }

  notify() {
    for (const listener of this.listeners) {
      listener(this.organizer);
    }
  }

  getOrganizer() {
    return this.organizer;
  }
}

export const authStore = new AuthStore();
// Initialize immediately
authStore.checkState();
