/**
 * events.js — Event grid rendering and event creation.
 */

import { apiFetch }    from './api.js';
import { showPage }    from './router.js';
// Removed getAuthToken
import { toastSuccess, toastError } from './toast.js';
import { formatDate, escapeHtml, customConfirm } from './ui.js';

/** Live events fetched from /api/v1/events */
let EVENTS = [];

/** Map of { [eventId]: eventTitle } for quick lookup */
export let eventNameMap = {};

/** Get the current EVENTS array */
export function getEvents() { return EVENTS; }

/** Get an event by ID */
export function getEventById(id) {
  return EVENTS.find((e) => e._id === id);
}

/**
 * Renders the events grid on the landing page.
 */
function renderEvents() {
  const grid = document.getElementById('events-grid');
  if (!grid) return;

  if (!EVENTS.length) {
    grid.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1">
        <div class="empty-icon">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
        </div>
        <div class="empty-title">No events yet</div>
        <div class="empty-desc">Ask an organiser to create events to get started.</div>
      </div>`;
    return;
  }

  const categoryColors = {
    Workshop:    'badge-blue',
    Seminar:     'badge-blue',
    Conference:  'badge-amber',
    Webinar:     'badge-gray',
    Hackathon:   'badge-green',
    Cultural:    'badge-red',
    Sports:      'badge-green',
    Networking:  'badge-gray',
    Other:       'badge-gray',
  };

  grid.innerHTML = EVENTS.map((e) => {
    const dateStr  = formatDate(e.date);
    const badgeClass = categoryColors[e.category] || 'badge-gray';

    return `
      <div class="event-card" data-action="open-feedback" data-event-id="${e._id}" role="button" tabindex="0" aria-label="Submit feedback for ${escapeHtml(e.title)}" style="position:relative;">
        <div class="event-card-header" style="margin-right:24px;">
          <div>
            <div class="event-card-title">${escapeHtml(e.title)}</div>
            <div class="event-card-meta">${dateStr}${e.venue ? ' · ' + escapeHtml(e.venue) : ''}</div>
          </div>
          <span class="badge ${badgeClass}">${escapeHtml(e.category)}</span>
        </div>
        <div class="event-card-cta">
          Submit Feedback
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
        </div>
      </div>`;
  }).join('');
}

/**
 * Fetch live events from /api/v1/events and render the grid.
 */
export async function loadEvents() {
  try {
    const res  = await apiFetch('/api/v1/events');
    // API returns { success, data: { events: [], total, page, pages } }
    EVENTS     = (res.data && Array.isArray(res.data.events)) ? res.data.events : [];
    eventNameMap = {};
    EVENTS.forEach((e) => { eventNameMap[e._id] = e.title; });
    renderEvents();
  } catch (e) {
    console.warn('Could not load events:', e.message);
    renderEvents(); // show empty state
  }
}

/**
 * Fetches the analytics summary and updates the hero card on the landing page.
 */
export async function updateHeroCard() {
  try {
    const { data } = await apiFetch('/api/dashboard');
    const stats    = data.stats || {};
    const total    = stats.totalResponses || 0;

    const hvResponses = document.getElementById('hv-responses');
    const hvRating    = document.getElementById('hv-rating');
    const hvEvents    = document.getElementById('hv-events');

    if (hvResponses) hvResponses.textContent = total;
    if (hvEvents)    hvEvents.textContent    = data.totalEvents || data.events?.length || 0;

    if (total > 0) {
      const avgRating = (stats.avgRating || 0).toFixed(1);
      if (hvRating) hvRating.textContent = avgRating + ' / 5';
    }
  } catch (e) {
    console.warn('Hero card unavailable:', e.message);
  }
}

/**
 * Create a new event from the dashboard.
 */
export async function doCreateEvent() {
  const title       = document.getElementById('ce-name')?.value.trim(); // Re-use the existing HTML ID
  const date        = document.getElementById('ce-date')?.value;
  const category    = document.getElementById('ce-category')?.value;
  const venue       = document.getElementById('ce-venue')?.value.trim();
  const description = document.getElementById('ce-description')?.value.trim();
  const errEl       = document.getElementById('create-event-error');
  const btn         = document.getElementById('create-event-btn');

  if (errEl) errEl.style.display = 'none';

  if (!title || !date || !category) {
    if (errEl) { errEl.textContent = 'Title, date, and category are required.'; errEl.style.display = 'block'; }
    return;
  }

  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Creating…';

  try {
    await apiFetch('/api/v1/events', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ title, date, category, venue, description, attendanceEnabled: true }), // Enable attendance by default for new events
    });

    // Reset form
    ['ce-name','ce-date','ce-description','ce-venue'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    const catEl = document.getElementById('ce-category');
    if (catEl) catEl.value = 'Workshop';

    // Close modal
    const modal = document.getElementById('create-event-modal');
    if (modal) modal.classList.add('hidden');

    await loadEvents();
    toastSuccess('Event created successfully!');

    // Refresh dashboard if on dashboard page
    const path = window.location.pathname;
    if (path.endsWith('dashboard.html')) {
      const { updateDashboard } = await import('./dashboard.js');
      updateDashboard();
    }
  } catch (e) {
    if (errEl) { errEl.textContent = e.message || 'Failed to create event.'; errEl.style.display = 'block'; }
    toastError(e.message || 'Failed to create event');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Create Event';
  }
}

/**
 * Handle deleting an event.
 */
export function doDeleteEvent(eventId, btn) {
  const evt = getEventById(eventId);
  if (!evt) return;

  customConfirm('Delete Event', `Are you sure you want to delete "${evt.title}"? This action cannot be undone.`, async () => {
    try {
      if (btn) {
        btn.innerHTML = '<span class="spinner" style="width:14px;height:14px;border-width:2px;margin:0;"></span>';
        btn.disabled = true;
      }
      await apiFetch(`/api/v1/events/${eventId}`, { method: 'DELETE' });
      toastSuccess('Event deleted successfully ✅');
      await loadEvents();
      // Also reload dashboard if on dashboard page
      if (window.location.pathname.includes('dashboard')) {
        const { updateDashboard } = await import('./dashboard.js');
        updateDashboard();
      }
    } catch (e) {
      toastError(e.message || 'Something went wrong ❌');
      if (btn) {
        btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>';
        btn.disabled = false;
      }
    }
  });
}
