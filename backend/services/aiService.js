/**
 * aiService.js — Full AI intelligence engine for EventPulse.
 *
 * Generates sentiment distribution, keyword tags, top suggestion phrases,
 * a rich markdown-like HTML summary, event health score, and trend comparison.
 * All results are cache-friendly — call from controllers with getOrSet().
 */

const Feedback = require('../models/Feedback');
const {
  getWordFrequency,
  analyzeSentiment,
  classifySentiment,
  extractKeywords,
  extractPhrases,
  generateSummary,
  getTopSuggestions,
  computeHealthScore,
  computeTrend,
} = require('../utils/textAnalysis');

/**
 * Generate a full AI intelligence payload for a set of event IDs.
 *
 * @param {ObjectId[]} eventIds
 * @param {{ avgRating: number, avgNPS: number, totalResponses: number }} [stats]
 * @returns {Promise<Object>} Full AI insights payload
 */
const generateAIAnalysis = async (eventIds, stats = {}) => {
  if (!eventIds.length) {
    return _emptyPayload();
  }

  // Fetch only the fields needed for analysis — fast lean query
  const feedbacks = await Feedback.find(
    { eventId: { $in: eventIds } },
    'overallRating recommendationScore comments createdAt'
  ).lean();

  if (!feedbacks.length) return _emptyPayload();

  const comments    = feedbacks.map((f) => f.comments    || '').filter(Boolean);
  const suggestions = []; // Removed since there is no suggestion field
  const allTexts    = [...comments];

  // ── 1. Sentiment Distribution ──────────────────────────────────────────
  const sentimentCounts = { positive: 0, neutral: 0, negative: 0 };
  for (const f of feedbacks) {
    // Use stored sentiment if already computed, otherwise derive
    const label = f.sentiment || classifySentiment(f.overallRating, f.comments);
    sentimentCounts[label] = (sentimentCounts[label] || 0) + 1;
  }
  const total = feedbacks.length;
  const sentimentDistribution = [
    { label: 'positive', count: sentimentCounts.positive, percent: Math.round((sentimentCounts.positive / total) * 100) },
    { label: 'neutral',  count: sentimentCounts.neutral,  percent: Math.round((sentimentCounts.neutral  / total) * 100) },
    { label: 'negative', count: sentimentCounts.negative, percent: Math.round((sentimentCounts.negative / total) * 100) },
  ];

  // ── 2. Keyword Tags ────────────────────────────────────────────────────
  const keywords = extractKeywords(allTexts, 18);

  // ── 3. Top Suggestion Phrases ──────────────────────────────────────────
  const topSuggestions = getTopSuggestions(suggestions, 8);

  // ── 4. Top Comment Words (for word-cloud data) ─────────────────────────
  const topCommentWords = getWordFrequency(comments).slice(0, 12);

  // ── 5. Notable Phrases ─────────────────────────────────────────────────
  const notablePhrases = extractPhrases(comments, 6);

  // ── 6. Rich HTML Summary ───────────────────────────────────────────────
  const summary = generateSummary(comments, suggestions, sentimentCounts, stats.avgRating || 0);

  // ── 7. Event Health Score ──────────────────────────────────────────────
  const healthScore = computeHealthScore(stats, sentimentCounts);

  // ── 8. Trend (recent half vs older half of responses) ─────────────────
  let trend = { ratingDelta: 0, npsDelta: 0, responsesDelta: 0, trending: 'stable' };
  if (feedbacks.length >= 4) {
    const sorted  = [...feedbacks].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    const midIdx  = Math.floor(sorted.length / 2);
    const older   = sorted.slice(0, midIdx);
    const recent  = sorted.slice(midIdx);

    const avgOf = (arr, key) => arr.reduce((s, f) => s + (f[key] || 0), 0) / arr.length;

    const prevStats = {
      avgRating:      Math.round(avgOf(older,  'overallRating') * 10) / 10,
      avgNPS:         Math.round(avgOf(older,  'recommendationScore')    * 10) / 10,
      totalResponses: older.length,
    };
    const currStats = {
      avgRating:      Math.round(avgOf(recent, 'overallRating') * 10) / 10,
      avgNPS:         Math.round(avgOf(recent, 'recommendationScore')    * 10) / 10,
      totalResponses: recent.length,
    };
    trend = computeTrend(currStats, prevStats);
  }
  let result;
  try {
    // Timeout wrapper for future external API (e.g., Gemini) integration
    const aiPromise = new Promise((resolve) => {
      resolve({
        summary,
        sentimentDistribution,
        keywords,
        topSuggestions,
        topCommentWords,
        notablePhrases,
        healthScore,
        trend,
        totalCommentsAnalyzed: comments.length,
        totalSuggestionsAnalyzed: suggestions.length,
      });
    });

    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('AI Analytics Generation Timeout')), 8000)
    );

    result = await Promise.race([aiPromise, timeoutPromise]);
  } catch (err) {
    const logger = require('../utils/logger');
    logger.error('AI Service Failed:', err);
    return _emptyPayload(); // Fallback on timeout or failure
  }

  return result;
};

/**
 * Classify and return sentiment label for a single feedback entry.
 * Called at submission time to store sentiment in DB.
 *
 * @param {number} rating
 * @param {string} comment
 * @returns {'positive'|'neutral'|'negative'}
 */
const getSentimentLabel = (rating, comment) => classifySentiment(rating, comment);

/** Empty payload when no data exists */
const _emptyPayload = () => ({
  summary: 'No feedback has been submitted yet. Create an event and collect responses to generate AI insights.',
  sentimentDistribution: [
    { label: 'positive', count: 0, percent: 0 },
    { label: 'neutral',  count: 0, percent: 0 },
    { label: 'negative', count: 0, percent: 0 },
  ],
  keywords:       [],
  topSuggestions: [],
  topCommentWords: [],
  notablePhrases: [],
  healthScore:    { score: 0, label: 'No Data', color: '#94A3B8' },
  trend:          { ratingDelta: 0, npsDelta: 0, responsesDelta: 0, trending: 'stable' },
  totalCommentsAnalyzed:    0,
  totalSuggestionsAnalyzed: 0,
});

module.exports = { generateAIAnalysis, getSentimentLabel: classifySentiment };
