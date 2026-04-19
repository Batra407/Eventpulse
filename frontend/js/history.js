/**
 * history.js — Historical feedback with search, filter, and pagination.
 */

import { apiFetch }    from './api.js';
import { eventNameMap } from './events.js';
import { formatDate, escapeHtml, debounce } from './ui.js';
import { showPage }    from './router.js';

let currentPage   = 1;
let totalPages    = 1;
let searchQuery   = '';

/**
 * Loads feedback data and renders the History page cards.
 * @param {number} [page=1]
 */
export async function renderHistory(page = 1) {
  currentPage = page;
  const grid  = document.getElementById('history-grid');
  const info  = document.getElementById('history-pagination-info');

  if (grid) {
    grid.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1">
        <div class="empty-icon">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"/><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"/></svg>
        </div>
        <div class="empty-title">Loading history…</div>
      </div>`;
  }

  try {
    let url = `/api/history?limit=50&page=${page}`;
    if (searchQuery) url += `&search=${encodeURIComponent(searchQuery)}`;

    const response = await apiFetch(url);
    // API returns { success, data: { feedbacks: [], total, page, pages } }
    const { feedbacks: all = [], total = 0, page: currentPageResp = page, pages = 1 } = response.data || {};
    totalPages     = pages;

    // Update pagination info
    if (info) {
      info.textContent = `Page ${currentPageResp} of ${totalPages} · ${total} total`;
    }

    // Update pagination buttons
    updatePaginationButtons();

    if (!all.length) {
      grid.innerHTML = `
        <div class="empty-state" style="grid-column:1/-1">
          <div class="empty-icon">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="9" y1="3" x2="9" y2="21"/></svg>
          </div>
          <div class="empty-title">No feedback found</div>
          <div class="empty-desc">${searchQuery ? 'Try a different search term.' : 'No historical feedback yet.'}</div>
        </div>`;
      return;
    }

    // Render flat list instead of grouping by event cards
    grid.innerHTML = all.map((f) => {
      const evName    = escapeHtml(f.eventName || eventNameMap[f.eventId] || 'Unknown Event');
      const ratingColor = f.rating >= 4 ? 'var(--success)' : f.rating === 3 ? 'var(--warning)' : 'var(--danger)';
      const date      = formatDate(f.createdAt);
      const stars     = '★'.repeat(f.rating) + '☆'.repeat(5 - f.rating);

      return `
        <div class="list-item" style="padding: 16px 20px;">
          <div class="list-item-content">
            <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:6px;">
              <div class="list-item-title">${evName}</div>
              <span style="font-size:0.75rem;color:var(--text-4);flex-shrink:0;">${date}</span>
            </div>
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px;">
              <span style="font-size:0.875rem;font-weight:700;color:${ratingColor};letter-spacing:1px;">${stars}</span>
              <span class="badge ${f.rating >= 4 ? 'badge-green' : f.rating === 3 ? 'badge-amber' : 'badge-red'}">${f.rating}/5</span>
            </div>
            <div class="list-item-body">${escapeHtml(f.comment || 'No comment provided.')}</div>
          </div>
        </div>`;
    }).join('');
  } catch (e) {
    if (grid) {
      grid.innerHTML = `
        <div class="empty-state" style="grid-column:1/-1;">
          <div class="empty-icon" style="color:var(--danger)">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          </div>
          <div class="empty-title">Failed to load history</div>
          <div class="empty-desc">${escapeHtml(e.message)}</div>
        </div>`;
    }
    console.error('History error:', e);
  }
}

/** Update pagination button states */
function updatePaginationButtons() {
  const prevBtn = document.getElementById('history-prev');
  const nextBtn = document.getElementById('history-next');
  if (prevBtn) prevBtn.disabled = currentPage <= 1;
  if (nextBtn) nextBtn.disabled = currentPage >= totalPages;
}

/** Navigate to previous page */
export function historyPrev() {
  if (currentPage > 1) renderHistory(currentPage - 1);
}

/** Navigate to next page */
export function historyNext() {
  if (currentPage < totalPages) renderHistory(currentPage + 1);
}

/** Handle search input */
export function handleHistorySearch(value) {
  searchQuery = value;
  renderHistory(1);
}

/** Initialize history event listeners */
export function initHistoryListeners() {
  const searchInput = document.getElementById('history-search');
  if (searchInput) {
    searchInput.addEventListener('input', debounce((e) => {
      handleHistorySearch(e.target.value);
    }, 400));
  }
}
