/**
 * report.js — Report generation, download, and copy.
 */

import { apiFetch }    from './api.js';
import { eventNameMap } from './events.js';
import { formatDate, escapeHtml } from './ui.js';
import { toastSuccess, toastError } from './toast.js';

/**
 * Fetches the full report and populates the Reports page.
 */
export async function updateReport() {
  const responsesList = document.getElementById('report-responses-list');
  if (responsesList) {
    responsesList.innerHTML = '<div style="color:var(--muted);font-size:0.875rem">Loading report…</div>';
  }

  try {
    const { data } = await apiFetch('/api/report');
    const { stats, aiSummary, topSuggestions, allFeedback } = data;
    const total = stats.totalResponses || 0;

    // Header info
    const genEl = document.getElementById('report-generated');
    if (genEl) genEl.textContent = `Generated on ${new Date().toDateString()} · ${total} responses`;

    // KPIs
    setReportKPI('r-avg', stats.avgRating ? stats.avgRating + '★' : '—');
    setReportKPI('r-total', total);
    setReportKPI('r-nps', stats.avgNPS || '—');

    // AI Summary
    const aiBox = document.getElementById('report-ai-text');
    if (aiSummary && aiBox) aiBox.innerHTML = aiSummary;

    // Suggestions
    const sugList = document.getElementById('report-suggestions-list');
    if (topSuggestions?.length && sugList) {
        sugList.innerHTML = topSuggestions
          .map((s, i) => `
            <div class="sug-row">
              <span class="sug-num">#${i + 1}</span>
              <span class="sug-word">${escapeHtml(s.word)}</span>
              <span class="sug-count">${s.count} mentions</span>
            </div>`)
          .join('');
    }

    // All responses
    if (total > 0 && responsesList) {
      responsesList.innerHTML = allFeedback.map((f) => {
        const evName = escapeHtml(f.eventName || eventNameMap[f.eventId] || '—');
        const starColor = f.overallRating >= 4 ? 'var(--success)' : f.overallRating === 3 ? 'var(--warning)' : 'var(--danger)';
        const date   = formatDate(f.createdAt);
        return `
          <div class="focus-list-item">
            <div class="focus-list-content">
              <div class="focus-list-title" style="display:flex; justify-content:space-between;">
                ${evName}
                <span style="color:var(--text-3); font-weight:500; font-size:13px;">${date} | NPS: ${f.recommendationScore || '—'}/10</span>
              </div>
              <div style="font-weight:600; color:${starColor}; margin-bottom:4px; font-size:14px;">
                ${'★'.repeat(f.overallRating)} ${f.overallRating}/5
              </div>
              <div class="focus-list-desc" style="color:var(--text-2); line-height:1.5;">
                ${escapeHtml(f.comments || 'No comment provided.')}
              </div>
              ${f.attendeeEmail ? `<div style="margin-top:6px; font-size:13px; color:var(--text-3);">${escapeHtml(f.attendeeEmail)}</div>` : ''}
            </div>
          </div>`;
      }).join('');
    } else if (responsesList) {
      responsesList.innerHTML = '<div style="color:var(--muted);font-size:0.875rem">No responses recorded yet.</div>';
    }
  } catch (e) {
    if (responsesList) {
      responsesList.innerHTML = `<div style="color:var(--red);font-size:0.875rem">Failed to load report: ${escapeHtml(e.message)}</div>`;
    }
    console.error('Report error:', e);
  }
}

function setReportKPI(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

/**
 * Downloads the report as a plain-text .txt file.
 */
export async function downloadReport() {
  try {
    const { data }                          = await apiFetch('/api/report');
    const { stats, aiSummary, allFeedback } = data;

    const lines = [
      'EVENTPULSE — FEEDBACK REPORT',
      `Generated: ${new Date().toDateString()}`,
      '='.repeat(50),
      `Total Responses: ${stats.totalResponses}`,
      `Average Rating:  ${stats.avgRating}/5`,
      `Average NPS:     ${stats.avgNPS}/10`,
      '',
      'AI SUMMARY:',
      aiSummary || 'N/A',
      '',
      'ALL RESPONSES:',
    ];

    allFeedback.forEach((f) => {
      const evName = f.eventName || eventNameMap[f.eventId] || 'Unknown Event';
      const date   = new Date(f.createdAt).toLocaleDateString();
      lines.push(`\n[${date}] ${evName} — ${f.overallRating}/5 stars`);
      lines.push(`Comment: ${f.comments || 'N/A'}`);
      lines.push(`NPS: ${f.recommendationScore}/10`);
    });

    const a = document.createElement('a');
    a.href     = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/plain' }));
    a.download = 'EventPulse-Report-' + new Date().toISOString().slice(0, 10) + '.txt';
    a.click();
    URL.revokeObjectURL(a.href);
    toastSuccess('Report downloaded!');
  } catch (e) {
    console.error('Download error:', e);
    toastError('Download failed: ' + e.message);
  }
}

/**
 * Copies a brief text summary of the report to the clipboard.
 */
export async function copyReport() {
  try {
    const { data }             = await apiFetch('/api/report');
    const { stats, aiSummary } = data;

    const text = [
      `EventPulse Report — ${new Date().toDateString()}`,
      `Responses: ${stats.totalResponses} | Avg Rating: ${stats.avgRating}/5 | NPS: ${stats.avgNPS}/10`,
      '',
      `Summary: ${aiSummary}`,
    ].join('\n');

    await navigator.clipboard.writeText(text);
    toastSuccess('Report copied to clipboard!');
  } catch (e) {
    console.error('Copy error:', e);
    toastError('Copy failed');
  }
}
