/**
 * dashboard.js — Dashboard module with Chart.js integration.
 * Premium upgrade: count-up KPIs, Live badge, scroll reveal, last updated.
 */

import { apiFetch }    from './api.js';
import { eventNameMap } from './events.js';
import { formatDate, escapeHtml, skeletonKPIs, countUp, initScrollReveal } from './ui.js';

/** Cache feedback data for cross-module use */
let feedbackData = [];
export function getFeedbackData() { return feedbackData; }

/** Chart.js instances */
let ratingChart   = null;
let categoryChart = null;

/**
 * Renders the "Live" badge + last-updated line in the dashboard header.
 */
function renderLiveBadge() {
  const headerDiv = document.querySelector('#dash-header-badges');
  if (!headerDiv) return;

  const now = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  headerDiv.innerHTML = `
    <span class="live-badge">
      <span class="live-badge-dot"></span>
      Live
    </span>
    <span class="last-updated">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
      Updated ${now}
    </span>
  `;
}

/**
 * Loads all dashboard data in parallel.
 */
export async function updateDashboard() {
  const tbody   = document.getElementById('feedback-tbody');
  const kpiGrid = document.getElementById('kpi-grid');

  // Show skeleton KPIs
  if (kpiGrid) kpiGrid.innerHTML = skeletonKPIs();
  if (tbody)   tbody.innerHTML = `<div style="color:var(--text-3); font-size:14px; padding:20px 0 20px 20px;">Loading responses…</div>`;

  // Render Live badge immediately
  renderLiveBadge();

  try {
    const [dashData, aiData] = await Promise.all([
      apiFetch('/api/dashboard'),
      apiFetch('/api/ai/summary'),
    ]);

    const { stats, events: orgEvents, ratingDistribution, categoryDistribution } = dashData.data;
    const ai = aiData.data;

    // Build event name map
    (orgEvents || []).forEach((e) => { eventNameMap[e._id] = e.title; });

    const total    = stats.totalResponses || 0;
    const avgRat   = total > 0 ? (stats.avgRating || 0) : 0;
    const npsScore = total > 0 ? (stats.avgNPS     || 0) : 0;

    // ── KPI cards (animated) ──
    kpiGrid.innerHTML = `
      <div class="kpi-card accent-blue reveal">
        <div class="kpi-icon kpi-icon-blue" aria-hidden="true">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
        </div>
        <div class="kpi-value" id="kpi-total">0</div>
        <div class="kpi-label">Total Responses</div>
        ${total > 0 ? `<div class="kpi-trend up"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"/></svg>Active</div>` : ''}
      </div>
      <div class="kpi-card accent-amber reveal">
        <div class="kpi-icon kpi-icon-amber" aria-hidden="true">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
        </div>
        <div class="kpi-value" id="kpi-avg">${total > 0 ? '0.0' : '—'}</div>
        <div class="kpi-label">Avg. Rating</div>
        ${total > 0 ? `<div class="kpi-trend up"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"/></svg>/ 5 stars</div>` : ''}
      </div>
      <div class="kpi-card accent-green reveal">
        <div class="kpi-icon kpi-icon-green" aria-hidden="true">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
        </div>
        <div class="kpi-value" id="kpi-events">0</div>
        <div class="kpi-label">Active Events</div>
        ${orgEvents?.length > 0 ? `<div class="kpi-trend up"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"/></svg>Running</div>` : ''}
      </div>
      <div class="kpi-card accent-purple reveal">
        <div class="kpi-icon kpi-icon-purple" aria-hidden="true">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
        </div>
        <div class="kpi-value" id="kpi-nps">${total > 0 ? '0' : '—'}</div>
        <div class="kpi-label">NPS Score</div>
        ${total > 0 ? `<div class="kpi-trend ${npsScore >= 50 ? 'up' : 'down'}"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="${npsScore >= 50 ? '18 15 12 9 6 15' : '6 9 12 15 18 9'}"/></svg>${npsScore >= 50 ? 'Promoters' : 'Needs work'}</div>` : ''}
      </div>
    `;

    // Animate KPI numbers
    const kpiTotalEl = document.getElementById('kpi-total');
    const kpiAvgEl   = document.getElementById('kpi-avg');
    const kpiEvtEl   = document.getElementById('kpi-events');
    const kpiNpsEl   = document.getElementById('kpi-nps');

    countUp(kpiTotalEl, total,                1000);
    countUp(kpiEvtEl,  orgEvents?.length || 0, 900);
    if (total > 0) {
      countUp(kpiAvgEl,  avgRat,   1000, ' / 5', 1);
      countUp(kpiNpsEl,  npsScore, 1100);
    }

    // Trigger scroll reveal on newly injected KPI cards
    initScrollReveal();

    const countEl = document.getElementById('feedback-count');
    if (countEl) countEl.textContent = total + (total === 1 ? ' response' : ' responses');

    // ── Event filter dropdown ──
    populateEventFilter(orgEvents || []);
    
    // ── QR Attendance Event Dropdown ──
    const escapeHtml = (str) => String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const qaSel = document.getElementById('qa-event-sel');
    if (qaSel) {
      const attEvents = (orgEvents || []).filter(e => e.attendanceEnabled);
      if (attEvents.length === 0) {
        qaSel.innerHTML = '<option value="">No events with attendance enabled</option>';
      } else {
        qaSel.innerHTML = '<option value="">-- Choose an event --</option>' + attEvents.map(e =>
          `<option value="${e._id}">${escapeHtml(e.title || e.name || 'Unnamed Event')}</option>`
        ).join('');
      }
    }

    // ── Feedback Table ──
    const histRes = await apiFetch('/api/history?limit=100');
    // API returns { success, data: { feedbacks: [], total, page, pages } }
    const all     = histRes.data?.feedbacks || [];
    feedbackData  = all;

    if (all.length === 0) {
      tbody.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
          </div>
          <div class="empty-title">No feedback yet</div>
          <div class="empty-desc">Submit from an event to see responses here.</div>
        </div>`;
    } else {
      tbody.innerHTML = all.map((f) => {
        const evName = escapeHtml(f.eventName || eventNameMap[f.eventId] || '—');
        const ratingColor = f.overallRating >= 4 ? 'var(--success)' : f.overallRating === 3 ? 'var(--warning)' : 'var(--danger)';
        const date  = formatDate(f.createdAt);
        const stars = '★'.repeat(f.overallRating) + '☆'.repeat(5 - f.overallRating);
        const sentiment = f.sentiment || 'neutral';
        const sentimentEmoji = sentiment === 'positive' ? '😊' : sentiment === 'negative' ? '😞' : '😐';
        return `
          <div class="list-item" style="padding: 16px 20px;">
            <div class="list-item-content">
              <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:6px;">
                <div class="list-item-title">${evName}</div>
                <span style="font-size:0.75rem;color:var(--text-4);flex-shrink:0;">${date}</span>
              </div>
              <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;flex-wrap:wrap;">
                <span style="font-size:0.875rem;font-weight:700;color:${ratingColor};letter-spacing:1px;">${stars}</span>
                <span class="badge ${f.overallRating >= 4 ? 'badge-green' : f.overallRating === 3 ? 'badge-amber' : 'badge-red'}">${f.overallRating}/5</span>
                <span class="sentiment-badge ${sentiment}">${sentimentEmoji} ${sentiment}</span>
              </div>
              <div class="list-item-body">${escapeHtml(f.comments || 'No comment provided.')}</div>
            </div>
          </div>`;
      }).join('');
    }

    // ── AI Insights tab — full intelligence panel ──
    renderAIInsightsPanel(ai, stats);

    // ── Charts ──
    renderRatingChart(ratingDistribution || []);
    renderCategoryChart(categoryDistribution || []);

    // ── Rating Distribution bars ──
    const ratingArr      = ratingDistribution || [];
    const totalRated     = ratingArr.reduce((s, r) => s + r.count, 0) || 1;
    const ratingBarsWrap = document.getElementById('rating-bars-dash');
    if (ratingBarsWrap) {
      let rHtml = '';
      [5, 4, 3, 2, 1].forEach((r) => {
        const found = ratingArr.find((x) => x.rating === r);
        const count = found ? found.count : 0;
        const pct   = Math.round((count / totalRated) * 100);
        const color = r === 5 ? 'var(--success)'
                    : r === 4 ? '#34d399'
                    : r === 3 ? 'var(--warning)'
                    : r === 2 ? '#fb923c'
                    : 'var(--danger)';
        rHtml += `
          <div class="rating-bar-row">
            <div class="rating-bar-label">${r}★</div>
            <div class="rating-bar-track">
              <div class="rating-bar-fill" style="width:${pct}%; background:${color}"></div>
            </div>
            <div class="rating-bar-count">${pct}%</div>
          </div>`;
      });
      ratingBarsWrap.innerHTML = rHtml;
    }

    // ── Category breakdown bars ──
    const cats = categoryDistribution || [];
    if (cats.length) {
      const max     = cats[0].count || 1;
      const catDiv  = document.getElementById('cat-chart-dash');
      if (catDiv) {
        catDiv.innerHTML = cats.slice(0, 6).map((c) => {
          const pct = Math.round((c.count / max) * 100);
          return `
            <div class="cat-bar-row">
              <span class="cat-bar-label">${escapeHtml(c.category)}</span>
              <div class="cat-bar-track"><div class="cat-bar-fill" style="width:${pct}%"></div></div>
              <span class="cat-bar-count">${c.count}</span>
            </div>`;
        }).join('');
      }
    }

  } catch (e) {
    if (tbody) {
      tbody.innerHTML = `
        <div style="color:var(--danger); font-size:14px; padding:20px;">
          Failed to load: ${escapeHtml(e.message)}
        </div>`;
    }
    // Restore real KPI cards on error
    if (kpiGrid) kpiGrid.innerHTML = `
      <div class="kpi-card accent-blue"><div class="kpi-value">—</div><div class="kpi-label">Total Responses</div></div>
      <div class="kpi-card accent-amber"><div class="kpi-value">—</div><div class="kpi-label">Avg. Rating</div></div>
      <div class="kpi-card accent-green"><div class="kpi-value">—</div><div class="kpi-label">Active Events</div></div>
      <div class="kpi-card accent-purple"><div class="kpi-value">—</div><div class="kpi-label">NPS Score</div></div>`;
    console.error('Dashboard error:', e);
  }
}

/**
 * Render the full AI Insights panel into #panel-ai.
 * Called after updateDashboard receives the AI payload.
 */
function renderAIInsightsPanel(ai, stats = {}) {
  const panel = document.getElementById('panel-ai');
  if (!panel) return;

  if (!ai) {
    panel.innerHTML = `
      <div class="card">
        <div class="ai-loading-state">
          <div class="ai-shimmer"></div>
          <div class="ai-shimmer"></div>
          <div class="ai-shimmer"></div>
          <div class="ai-shimmer"></div>
        </div>
      </div>`;
    return;
  }

  const h = ai.healthScore || { score: 0, label: 'No Data', color: '#94A3B8' };
  const trend = ai.trend || { ratingDelta: 0, npsDelta: 0, responsesDelta: 0, trending: 'stable' };
  const sentDist = ai.sentimentDistribution || [];
  const keywords = ai.keywords || [];
  const suggestions = ai.topSuggestions || [];
  const phrases = ai.notablePhrases || [];

  // Health ring SVG math
  const circumference = 2 * Math.PI * 28; // r=28
  const dashOffset = circumference - (h.score / 100) * circumference;

  // Sentiment bars HTML
  const SENT_EMOJI = { positive: '😊', neutral: '😐', negative: '😞' };
  const sentHtml = sentDist.map((s) => `
    <div class="sentiment-row">
      <div class="sentiment-label">${SENT_EMOJI[s.label] || ''} ${s.label}</div>
      <div class="sentiment-track">
        <div class="sentiment-fill ${s.label}" style="width:0%" data-pct="${s.percent}"></div>
      </div>
      <div class="sentiment-pct">${s.percent}%</div>
    </div>`).join('');

  // Keyword tags HTML
  const tagHtml = keywords.slice(0, 16).map((k) => `
    <span class="tag-pill${k.isDomain ? ' domain' : ''}" title="${k.count} mentions">
      ${escapeHtml(k.keyword)}
      <span class="tag-count">${k.count}</span>
    </span>`).join('');

  // Suggestions HTML
  const sugHtml = suggestions.slice(0, 6).map((s, i) => `
    <div class="suggestion-item">
      <div class="suggestion-rank">${i + 1}</div>
      <div class="suggestion-text">${escapeHtml(s.word)}</div>
      <div class="suggestion-count">${s.count} mention${s.count !== 1 ? 's' : ''}</div>
    </div>`).join('');

  // Trend card helper
  const tSign = (val) => val > 0 ? '+' : '';
  const tClass = (val) => val > 0 ? 'up' : val < 0 ? 'down' : 'stable';
  const tArrow = (val) => val > 0 ? '↑' : val < 0 ? '↓' : '→';

  // Phrases HTML
  const phraseHtml = phrases.length
    ? `<div class="ai-section">
        <div class="ai-section-title">Recurring Phrases</div>
        <div class="phrase-list">
          ${phrases.map((p) => `<span class="phrase-pill">"${escapeHtml(p.phrase)}"</span>`).join('')}
        </div>
      </div>`
    : '';

  panel.innerHTML = `
    <div class="card" style="padding: 24px;">

      <!-- AI Badge + Header -->
      <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:20px;">
        <h3 style="font-size:1rem; margin:0;">AI Intelligence Report</h3>
        <span class="ai-badge-animated">
          <span class="ai-badge-dot"></span>
          AI Generated
        </span>
      </div>

      <!-- Summary -->
      <div class="ai-section">
        <div class="ai-section-title">AI Summary</div>
        <div class="ai-summary-block">${ai.summary || 'No data available.'}</div>
      </div>

      <!-- Health Score -->
      <div class="ai-section">
        <div class="ai-section-title">Event Health Score</div>
        <div class="health-score-wrap">
          <svg class="health-ring-svg" width="80" height="80" viewBox="0 0 64 64" aria-label="Health score ${h.score}">
            <circle class="health-ring-track" cx="32" cy="32" r="28"/>
            <circle class="health-ring-fill" cx="32" cy="32" r="28"
              stroke="${h.color}"
              stroke-dasharray="${circumference}"
              stroke-dashoffset="${circumference}"
              id="health-ring-arc"
            />
            <text class="health-ring-text" x="32" y="30">${h.score}</text>
            <text class="health-ring-sub" x="32" y="41">/ 100</text>
          </svg>
          <div class="health-score-meta">
            <div class="health-score-label" style="color:${h.color};">${h.label}</div>
            <div class="health-score-desc">
              Based on avg. rating (${stats.avgRating || '—'}/5), NPS (${stats.avgNPS || '—'}/10), and sentiment analysis.
            </div>
          </div>
        </div>
      </div>

      <!-- Sentiment Distribution -->
      <div class="ai-section">
        <div class="ai-section-title">Sentiment Breakdown</div>
        <div class="sentiment-bars">${sentHtml || '<div style="color:var(--text-4);font-size:0.875rem;">No data yet</div>'}</div>
      </div>

      <!-- Trend Analysis -->
      <div class="ai-section">
        <div class="ai-section-title">Trend Analysis (Recent vs Earlier)</div>
        <div class="trend-row">
          <div class="trend-card">
            <div class="trend-val ${tClass(trend.ratingDelta)}">
              <span class="trend-arrow">${tArrow(trend.ratingDelta)}</span>
              ${tSign(trend.ratingDelta)}${trend.ratingDelta}
            </div>
            <div class="trend-lbl">Avg Rating</div>
          </div>
          <div class="trend-card">
            <div class="trend-val ${tClass(trend.npsDelta)}">
              <span class="trend-arrow">${tArrow(trend.npsDelta)}</span>
              ${tSign(trend.npsDelta)}${trend.npsDelta}
            </div>
            <div class="trend-lbl">NPS Score</div>
          </div>
          <div class="trend-card">
            <div class="trend-val ${tClass(trend.responsesDelta)}">
              <span class="trend-arrow">${tArrow(trend.responsesDelta)}</span>
              ${tSign(trend.responsesDelta)}${trend.responsesDelta}
            </div>
            <div class="trend-lbl">Responses</div>
          </div>
        </div>
      </div>

      <!-- Keywords -->
      ${keywords.length ? `
      <div class="ai-section">
        <div class="ai-section-title">Keyword Tags</div>
        <div class="tag-cloud">${tagHtml}</div>
      </div>` : ''}

      <!-- Suggestions -->
      ${suggestions.length ? `
      <div class="ai-section">
        <div class="ai-section-title">Top Improvement Suggestions</div>
        <div class="suggestion-list">${sugHtml}</div>
      </div>` : ''}

      <!-- Notable Phrases -->
      ${phraseHtml}

    </div>`;

  // Animate health ring after DOM insert
  requestAnimationFrame(() => {
    const arc = document.getElementById('health-ring-arc');
    if (arc) arc.style.strokeDashoffset = dashOffset;

    // Animate sentiment bars
    panel.querySelectorAll('.sentiment-fill').forEach((bar) => {
      bar.style.width = (bar.dataset.pct || 0) + '%';
    });
  });
}

/** Populate the event filter dropdown */
function populateEventFilter(events) {
  const select = document.getElementById('dash-event-filter');
  if (!select) return;
  const current = select.value;
  select.innerHTML = '<option value="all">All Events</option>';
  events.forEach((e) => {
    select.innerHTML += `<option value="${e._id}">${escapeHtml(e.title)}</option>`;
  });
  select.value = current || 'all';
}

/** Dashboard tab switcher */
export function switchTab(btn, panelId) {
  document.querySelectorAll('.tab-btn').forEach((t) => t.classList.remove('active'));
  btn.classList.add('active');
  document.querySelectorAll('.tab-panel').forEach((p) => p.classList.remove('active'));
  const panel = document.getElementById(panelId);
  if (panel) panel.classList.add('active');
}

/* ── Chart.js Renderers ─────────────────────────────────────── */

function renderRatingChart(ratingData) {
  const canvas = document.getElementById('rating-donut-chart');
  if (!canvas || typeof Chart === 'undefined') return;

  if (ratingChart) ratingChart.destroy();

  const counts = [1, 2, 3, 4, 5].map((r) => {
    const found = ratingData.find((d) => d.rating === r);
    return found ? found.count : 0;
  });

  ratingChart = new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels: ['1★', '2★', '3★', '4★', '5★'],
      datasets: [{
        data: counts,
        backgroundColor: ['#dc2626', '#fb923c', '#f59e0b', '#34d399', '#059669'],
        borderWidth: 0,
        borderRadius: 4,
        spacing: 2,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '65%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            padding: 16,
            usePointStyle: true,
            pointStyleWidth: 8,
            font: { family: "'Inter', sans-serif", size: 11, weight: '500' },
          },
        },
      },
      animation: {
        duration: 800,
        easing: 'easeOutCubic',
      },
    },
  });
}

function renderCategoryChart(catData) {
  const canvas = document.getElementById('category-bar-chart');
  if (!canvas || typeof Chart === 'undefined') return;

  if (categoryChart) categoryChart.destroy();

  const top = catData.slice(0, 8);
  if (!top.length) return;

  categoryChart = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: top.map((c) => c.category),
      datasets: [{
        data: top.map((c) => c.count),
        backgroundColor: [
          '#2563eb', '#059669', '#7c3aed', '#f59e0b',
          '#dc2626', '#06b6d4', '#ec4899', '#8b5cf6',
        ],
        borderWidth: 0,
        borderRadius: 6,
        barPercentage: 0.6,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: 'y',
      plugins: { legend: { display: false } },
      scales: {
        x: {
          grid: { display: false },
          ticks: { font: { family: "'Inter', sans-serif", size: 11 } },
        },
        y: {
          grid: { display: false },
          ticks: { font: { family: "'Inter', sans-serif", size: 11, weight: '500' } },
        },
      },
      animation: {
        duration: 700,
        easing: 'easeOutCubic',
      },
    },
  });
}

/* ── Auto-Refresh (Adaptive Polling + Backoff) ─────────────────────────── */

let _pollTimer   = null;
let _pollRunning = false;
let _errorCount  = 0;

/**
 * Start adaptive dashboard auto-refresh poll.
 * Phase 34 & 54: Memory leak prevention, deduplication, exponential backoff.
 */
export function startDashboardPoll() {
  if (_pollRunning) return;
  _pollRunning = true;

  const BASE_INTERVAL = 15_000; // 15 seconds

  const poll = async () => {
    // Phase 54: Pause when tab hidden
    if (document.visibilityState !== 'visible') {
      scheduleNext(BASE_INTERVAL);
      return;
    }

    try {
      // Use v1 endpoint
      const dashData = await apiFetch('/api/v1/dashboard');
      const { stats } = dashData.data || {};
      _errorCount = 0; // reset backoff on success

      // ── Silently update KPI numbers ──
      const total    = stats?.totalResponses || 0;
      const attendees= stats?.totalAttendees || 0;
      const avgRat   = stats?.avgRating      || 0;
      const npsScore = stats?.avgNPS         || 0;

      const kpiTotalEl = document.getElementById('kpi-total');
      const kpiAvgEl   = document.getElementById('kpi-avg');
      const kpiNpsEl   = document.getElementById('kpi-nps');

      if (kpiTotalEl && parseInt(kpiTotalEl.textContent) !== total) {
        const { countUp } = await import('./ui.js');
        countUp(kpiTotalEl, total, 600);
      }
      if (kpiAvgEl && total > 0) {
        const { countUp } = await import('./ui.js');
        countUp(kpiAvgEl, avgRat,   700, ' / 5', 1);
        countUp(kpiNpsEl, npsScore, 700);
      }

      renderLiveBadge();
      
      scheduleNext(BASE_INTERVAL);

    } catch (err) {
      _errorCount++;
      // Exponential backoff: max out at ~2 minutes
      const backoff = Math.min(BASE_INTERVAL * Math.pow(2, _errorCount), 120_000);
      console.debug(`[Auto-refresh] Poll failed. Backing off for ${backoff}ms`, err.message);
      scheduleNext(backoff);
    }
  };

  const scheduleNext = (delay) => {
    if (!_pollRunning) return;
    if (_pollTimer) clearTimeout(_pollTimer);
    _pollTimer = setTimeout(poll, delay);
  };

  // Listen for tab visibility changes
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && _pollRunning) {
      if (_pollTimer) clearTimeout(_pollTimer);
      poll();
    }
  });

  scheduleNext(BASE_INTERVAL);
}

/**
 * Phase 34: Stop polling and clean up memory on unmount
 */
export function stopDashboardPoll() {
  _pollRunning = false;
  if (_pollTimer) {
    clearTimeout(_pollTimer);
    _pollTimer = null;
  }
}

/* ── QR Attendance Logic ─────────────────────────────────────────────────── */

let currentQAEvent = null;
let currentQAAttendees = [];

window.onQAEventChange = async function() {
  const sel = document.getElementById('qa-event-sel');
  const eventId = sel.value;
  if (!eventId) {
    document.getElementById('qa-no-event').style.display = 'block';
    document.getElementById('qa-disabled-msg').style.display = 'none';
    document.getElementById('qa-content').style.display = 'none';
    document.getElementById('qa-att-badge').style.display = 'none';
    return;
  }

  try {
    const res = await apiFetch(`/api/v1/events/${eventId}`);
    currentQAEvent = res.data;
    
    document.getElementById('qa-no-event').style.display = 'none';

    if (!currentQAEvent.attendanceEnabled) {
      document.getElementById('qa-disabled-msg').style.display = 'block';
      document.getElementById('qa-content').style.display = 'none';
      document.getElementById('qa-att-badge').style.display = 'none';
    } else {
      document.getElementById('qa-disabled-msg').style.display = 'none';
      document.getElementById('qa-content').style.display = 'block';
      document.getElementById('qa-att-badge').style.display = 'block';

      // Setup QR Image and Link
      const qrCanvas = document.getElementById('qa-qr-canvas');
      const linkDiv = document.getElementById('qa-att-link');
      if (currentQAEvent.qrCode) {
        qrCanvas.innerHTML = `<img src="${currentQAEvent.qrCode}" style="max-width:100%; border-radius:8px;" />`;
      }
      if (currentQAEvent.attendanceLink) {
        linkDiv.textContent = window.location.origin + currentQAEvent.attendanceLink;
      }

      await loadQATable(eventId);
    }
  } catch (err) {
    const { toastError } = await import('./toast.js');
    toastError(err.message || 'Failed to load event details');
  }
};

async function loadQATable(eventId) {
  try {
    const res = await apiFetch(`/api/v1/attendance/${eventId}`);
    // API returns { success, data: { eventId, eventName, total, page, pages, attendees: [] } }
    currentQAAttendees = res.data?.attendees || [];
    renderQATable(currentQAAttendees);
  } catch (err) {
    console.error('Failed to load attendees', err);
  }
}

function renderQATable(attendees) {
  const tbody = document.getElementById('at-body');
  const totalEl = document.getElementById('qa-total');
  const emptyEl = document.getElementById('at-empty');

  totalEl.textContent = attendees.length;

  if (attendees.length === 0) {
    tbody.innerHTML = '';
    emptyEl.style.display = 'block';
  } else {
    emptyEl.style.display = 'none';
    tbody.innerHTML = attendees.map((a, i) => `
      <tr style="border-bottom:1px solid rgba(255,255,255,0.05);transition:background 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.03)'" onmouseout="this.style.background='transparent'">
        <td style="padding:14px 18px;font-size:12px;color:#fff;">${i + 1}</td>
        <td style="padding:14px 14px;font-size:12px;color:#fff;font-weight:600;">${escapeHtml(a.attendeeName)}</td>
        <td style="padding:14px 14px;font-size:12px;color: #44403c;">${escapeHtml(a.attendeeEmail)}</td>
        <td style="padding:14px 14px;font-size:12px;">
          <span style="display:inline-block;padding:4px 10px;border-radius:99px;font-weight:600;font-size:10px;text-transform:capitalize;
            ${a.status === 'present' ? 'background:rgba(52,211,153,0.15);color:#34d399;' : 
              a.status === 'absent' ? 'background:rgba(248,113,113,0.15);color:#f87171;' : 
              'background:rgba(251,191,36,0.15);color:#fbbf24;'}">
            ${a.status}
          </span>
        </td>
        <td style="padding:14px 14px;font-size:12px;color: #44403c;">${new Date(a.markedAt || a.createdAt).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</td>
        <td style="padding:14px 14px;text-align:center;">
          <span style="font-size:10px;font-weight:700;color: #44403c;background:rgba(255,255,255,0.05);padding:4px 8px;border-radius:6px;text-transform:uppercase;">
            ${a.attendanceType || '—'}
          </span>
        </td>
        <td style="padding:14px 18px;text-align:right;">
          <button onclick="deleteAttendee('${a._id}')" class="bs" style="padding:4px 8px;font-size:11px;color:#f87171;border-color:rgba(248,113,113,0.3);">Remove</button>
        </td>
      </tr>
    `).join('');
  }
}

window.filterQATable = function() {
  const query = document.getElementById('qa-search').value.toLowerCase();
  const filtered = currentQAAttendees.filter(a => 
    a.attendeeName.toLowerCase().includes(query) || 
    a.attendeeEmail.toLowerCase().includes(query)
  );
  renderQATable(filtered);
};

window.copyQRLink = async function() {
  const link = document.getElementById('qa-att-link').textContent;
  if (!link) return;
  try {
    await navigator.clipboard.writeText(link);
    const { toastSuccess } = await import('./toast.js');
    toastSuccess('Attendance link copied!');
  } catch (err) {}
};

window.addManualAttendee = async function() {
  if (!currentQAEvent) return;
  const name = document.getElementById('qa-name').value.trim();
  const email = document.getElementById('qa-email').value.trim();
  const status = document.getElementById('qa-status').value;
  const errEl = document.getElementById('qa-manual-err');
  const btn = document.getElementById('qa-add-btn');

  errEl.style.display = 'none';
  if (!name || !email) {
    errEl.textContent = 'Name and email are required';
    errEl.style.display = 'block';
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Adding...';

  try {
    await apiFetch(`/api/v1/attendance/manual/${currentQAEvent._id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ attendeeName: name, attendeeEmail: email, status })
    });
    
    document.getElementById('qa-name').value = '';
    document.getElementById('qa-email').value = '';
    const { toastSuccess } = await import('./toast.js');
    toastSuccess('Attendee added manually');
    
    await loadQATable(currentQAEvent._id);
  } catch (err) {
    errEl.textContent = err.message || 'Failed to add attendee';
    errEl.style.display = 'block';
  } finally {
    btn.disabled = false;
    btn.textContent = 'Add Attendee';
  }
};

window.deleteAttendee = async function(attendanceId) {
  if (!currentQAEvent || !confirm('Are you sure you want to remove this attendee?')) return;
  try {
    await apiFetch(`/api/v1/attendance/${currentQAEvent._id}/${attendanceId}`, { method: 'DELETE' });
    const { toastSuccess } = await import('./toast.js');
    toastSuccess('Attendee removed');
    await loadQATable(currentQAEvent._id);
  } catch (err) {
    const { toastError } = await import('./toast.js');
    toastError(err.message || 'Failed to remove attendee');
  }
};

window.exportAttCSV = async function() {
  if (!currentQAEvent) return;
  const btn = document.querySelector('button[onclick="exportAttCSV()"]');
  const originalHtml = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner" style="width:12px;height:12px;"></span> Exporting...';
  try {
    const res = await apiFetch(`/api/v1/attendance/export/${currentQAEvent._id}`);
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(res.data, null, 2));
    const dlAnchorElem = document.createElement('a');
    dlAnchorElem.setAttribute("href", dataStr);
    dlAnchorElem.setAttribute("download", `attendance_${currentQAEvent._id}.json`);
    dlAnchorElem.click();
    dlAnchorElem.remove();
  } catch (err) {
    const { toastError } = await import('./toast.js');
    toastError('Failed to export attendance');
  } finally {
    btn.disabled = false;
    btn.innerHTML = originalHtml;
  }
};
