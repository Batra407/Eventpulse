/**
 * feedback.js — Feedback form module.
 * Handles star rating, NPS, chips, progress, and submission.
 */

import { apiFetch }    from './api.js';
import { showPage }    from './router.js';
import { getEventById, getEvents, updateHeroCard } from './events.js';
import { shakeEl }     from './ui.js';
import { toastSuccess, toastError } from './toast.js';

/** Captions shown below the star rating */
const RATING_CAPTIONS = [
  '',
  "😔 Poor — we're sorry to hear that",
  '😐 Fair — room for improvement',
  '🙂 Good — glad you enjoyed it',
  '😊 Great — happy to hear!',
  '🤩 Excellent — amazing!',
];

let selectedRating = 0;
let selectedNPS    = 0;
let selectedEvent  = null;

/**
 * Opens the feedback form for the given event.
 * @param {string} id - Event MongoDB _id
 */
export function openFeedback(id) {
  const currentPath = window.location.pathname;
  if (!currentPath.endsWith('feedback.html')) {
    window.location.href = `feedback.html?eventId=${id}`;
    return;
  }

  selectedEvent = getEventById(id);
  if (!selectedEvent) {
    console.warn('Event not found in public list, using fallback:', id);
    selectedEvent = { _id: id, title: 'Selected Event' };
  }
  selectedRating = 0;
  selectedNPS    = 0;

  // Update badge
  const badge = document.getElementById('form-badge');
  if (badge) badge.textContent = '✦ ' + selectedEvent.title;

  // Reset star & NPS
  document.querySelectorAll('.star-btn').forEach((b) => b.classList.remove('lit'));
  document.querySelectorAll('.nps-btn').forEach((b) => b.classList.remove('active'));
  const caption = document.getElementById('star-caption');
  if (caption) caption.textContent = 'Click to rate your experience';

  // Clear text fields
  const commentEl    = document.getElementById('comment-input');
  const suggestionEl = document.getElementById('suggestion-input');
  if (commentEl)    commentEl.value    = '';
  if (suggestionEl) suggestionEl.value = '';

  // Reset slider
  const slider = document.getElementById('content-slider');
  if (slider) {
    slider.value = 7;
    document.getElementById('content-val').textContent = '7';
    updateRange(slider, 'content-val');
  }

  // Deselect chips
  document.querySelectorAll('.chip').forEach((c) => c.classList.remove('active'));

  // Show form, hide success screen
  const formCard = document.getElementById('feedback-form-card');
  const success  = document.getElementById('success-screen');
  if (formCard) formCard.style.display = 'block';
  if (success)  success.style.display  = 'none';
}

/** Star rating handler */
export function setRating(val) {
  selectedRating = val;
  document.querySelectorAll('.star-btn').forEach((b, i) => b.classList.toggle('lit', i < val));
  const caption = document.getElementById('star-caption');
  if (caption) caption.textContent = RATING_CAPTIONS[val];
  updateProgress();
}

/** NPS handler */
export function setNPS(btn, val) {
  selectedNPS = val;
  document.querySelectorAll('.nps-btn').forEach((b) => b.classList.remove('active'));
  btn.classList.add('active');
  updateProgress();
}

/** Toggle category chip */
export function toggleChip(el) {
  el.classList.toggle('active');
  updateProgress();
}

/** Range slider sync */
export function updateRange(el, valId) {
  const v   = el.value;
  const pct = ((v - 1) / 9) * 100;
  el.style.setProperty('--pct', pct + '%');
  if (valId) {
    const valEl = document.getElementById(valId);
    if (valEl) valEl.textContent = v;
  }
}

/** Update the 4-step progress indicator */
export function updateProgress() {
  const comment = document.getElementById('comment-input')?.value.trim() || '';

  const steps = [
    selectedRating > 0,
    document.querySelectorAll('.chip.active').length > 0,
    selectedNPS > 0,
    comment.length > 0,
  ];

  const done = steps.filter(Boolean).length;

  [1, 2, 3, 4].forEach((i) => {
    const step = document.getElementById('ps' + i);
    if (step) step.style.background = i <= done ? 'var(--accent)' : 'var(--border)';
  });

  const labels  = ['Overall Rating', 'Category Selection', 'NPS Score', 'Your Thoughts'];
  const nextIdx = steps.findIndex((s) => !s);
  const label   = document.getElementById('progress-label');
  if (label) {
    label.textContent = nextIdx === -1
      ? 'All done — ready to submit!'
      : `Step ${nextIdx + 1} of 4 — ${labels[nextIdx]}`;
  }
}

/** Submit feedback to the API */
export async function submitFeedback() {
  if (!selectedRating) {
    shakeEl('feedback-form-card');
    return;
  }

  const comment = document.getElementById('comment-input').value.trim();
  if (!comment) {
    shakeEl('comment-input');
    document.getElementById('comment-input').focus();
    return;
  }

  const submitBtn = document.getElementById('submit-feedback-btn');
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spinner" style="width:14px;height:14px;border-width:2px;"></span> Submitting…';
  }

  const payload = {
    eventId:             selectedEvent._id,
    overallRating:       selectedRating,
    recommendationScore: selectedNPS || 5,
    selectedTags:        [...document.querySelectorAll('.chip.active')].map((c) => c.textContent.trim()),
    comments:            comment,
  };

  try {
    await apiFetch('/api/v1/feedback', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
    });

    document.getElementById('feedback-form-card').style.display = 'none';
    document.getElementById('success-screen').style.display     = 'block';
    toastSuccess('Feedback submitted successfully!');
    updateHeroCard();
  } catch (e) {
    toastError('Could not submit feedback: ' + e.message);
    console.error(e);
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = `Submit Feedback
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>`;
    }
  }
}

/**
 * Initialize feedback form event listeners.
 * Called once from main.js.
 */
export function initFeedbackListeners() {
  // Comment input updates progress
  const commentInput = document.getElementById('comment-input');
  if (commentInput) commentInput.addEventListener('input', updateProgress);

  // Content slider
  const slider = document.getElementById('content-slider');
  if (slider) {
    slider.addEventListener('input', () => updateRange(slider, 'content-val'));
    // Initialize gradient
    setTimeout(() => updateRange(slider, 'content-val'), 100);
  }

  if (window.location.pathname.endsWith('feedback.html')) {
    const urlParams = new URLSearchParams(window.location.search);
    const eventId = urlParams.get('eventId') || urlParams.get('id');
    
    if (eventId) {
      openFeedback(eventId);
    } else {
      // If user navigates directly to feedback.html without an ID, fallback to the first event
      const events = getEvents();
      if (events && events.length > 0) {
        console.log('No eventId in URL, falling back to first event:', events[0]._id);
        openFeedback(events[0]._id);
      } else {
        console.warn('No events found in database.');
      }
    }
  }
}
