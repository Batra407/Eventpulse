/**
 * textAnalysis.js — Core NLP utilities for EventPulse AI engine.
 *
 * Pure JS, zero external dependencies.
 * Implements: tokenization, sentiment, keyword extraction,
 * phrase extraction, summary generation, health score.
 */

/* ── Stop Words ─────────────────────────────────────────────── */

const STOP_WORDS = new Set([
  'the','a','an','and','or','but','in','on','at','to','for','of','with',
  'is','it','its','this','that','was','are','be','been','have','has','had',
  'do','did','will','would','could','should','may','might','i','we','you',
  'he','she','they','my','our','your','his','her','their','very','so','just',
  'not','no','more','also','from','as','by','up','out','if','about','which',
  'there','then','than','too','can','all','one','get','got','us','me','need',
  'really','like','good','great','nice','into','even','some','much','event',
  'was','were','said','say','says','make','made','going','went','come','came',
  'time','way','know','think','feel','felt','see','seen','lot','quite','bit',
  'overall','though','still','however','well','yes','please','thank','thanks',
]);

/* ── Sentiment Lexicon ──────────────────────────────────────── */

const POSITIVE_WORDS = new Set([
  'excellent','amazing','outstanding','wonderful','fantastic','superb','great',
  'good','brilliant','impressive','helpful','informative','engaging','smooth',
  'clear','organized','professional','knowledgeable','interesting','insightful',
  'useful','efficient','effective','enjoyed','loved','perfect','best','happy',
  'satisfied','appreciate','quality','awesome','inspiring','motivating','clear',
  'structured','punctual','interactive','friendly','supportive','thorough',
  'detailed','creative','innovative','practical','relevant','valuable','fun',
  'enthusiasm','passionate','clear','focused','productive','collaborative','rich',
  'seamless','comfortable','spacious','accessible','welcoming','responsive',
]);

const NEGATIVE_WORDS = new Set([
  'poor','bad','terrible','awful','horrible','disappointing','boring','confusing',
  'unclear','disorganized','unorganized','rushed','slow','late','delayed','noisy',
  'crowded','uncomfortable','irrelevant','outdated','incomplete','unhelpful',
  'difficult','complicated','problematic','frustrating','annoying','lacking',
  'insufficient','inadequate','waste','missed','limited','technical','issues',
  'error','errors','crash','failed','broken','overcrowded','cold','hot','small',
  'narrow','tight','short','overlong','lengthy','repetitive','redundant','vague',
  'abstract','disconnected','unprepared','unprofessional','rude','monotone',
  'low','weak','poor','bad','worst','never','nothing','fail','disappoint',
]);

/* ── Intensifiers ───────────────────────────────────────────── */
const INTENSIFIERS = new Set(['very','extremely','highly','incredibly','exceptionally','really','absolutely','completely','totally','utterly']);

/* ── Domain Keywords ────────────────────────────────────────── */
const DOMAIN_KEYWORDS = [
  'speaker','venue','content','timing','organization','seating','audio','video',
  'slides','networking','registration','food','refreshments','wifi','internet',
  'schedule','agenda','session','panel','workshop','q&a','discussion','material',
  'handout','resources','duration','pace','interaction','audience','breaks',
  'facilities','parking','transportation','accessibility','accommodation','host',
  'moderator','presenters','demonstrations','examples','case studies','activities',
];

/* ── Tokenization ───────────────────────────────────────────── */

/**
 * Tokenize text into cleaned word array.
 */
const tokenize = (text) =>
  (text || '')
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));

/**
 * Tokenize and count word frequencies across multiple texts.
 * @returns {{ word: string, count: number }[]} sorted desc
 */
const getWordFrequency = (texts) => {
  const freq = {};
  for (const text of texts) {
    for (const word of tokenize(text)) {
      freq[word] = (freq[word] || 0) + 1;
    }
  }
  return Object.entries(freq)
    .map(([word, count]) => ({ word, count }))
    .sort((a, b) => b.count - a.count);
};

/* ── Sentiment Analysis ─────────────────────────────────────── */

/**
 * Analyze the sentiment of a single text string.
 *
 * @param {string} text
 * @returns {{ label: 'positive'|'neutral'|'negative', score: number, confidence: number }}
 *   score: -1.0 → +1.0 (normalized)
 *   confidence: 0.0 → 1.0
 */
const analyzeSentiment = (text) => {
  if (!text?.trim()) return { label: 'neutral', score: 0, confidence: 0 };

  const words      = tokenize(text);
  if (!words.length) return { label: 'neutral', score: 0, confidence: 0 };

  let posScore  = 0;
  let negScore  = 0;
  let intensity = 1;

  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    // Look one word back for intensifier
    if (i > 0 && INTENSIFIERS.has(words[i - 1])) {
      intensity = 1.5;
    } else {
      intensity = 1;
    }

    if (POSITIVE_WORDS.has(w)) posScore += (1 * intensity);
    else if (NEGATIVE_WORDS.has(w)) negScore += (1 * intensity);
  }

  // Also factor in star rating context words
  const rawText = text.toLowerCase();
  const hasNegation = /\b(not|never|no|don't|didn't|wasn't|couldn't|wouldn't)\b/.test(rawText);

  if (hasNegation) {
    // Flip dominant polarity if negation detected
    const tmp = posScore;
    posScore = negScore;
    negScore = tmp;
  }

  const totalSignals = posScore + negScore;
  const normalizedScore = totalSignals === 0 ? 0 : (posScore - negScore) / Math.max(totalSignals, 1);
  const confidence = Math.min(totalSignals / Math.max(words.length * 0.15, 1), 1);

  let label;
  if (normalizedScore > 0.15)      label = 'positive';
  else if (normalizedScore < -0.15) label = 'negative';
  else                              label = 'neutral';

  return { label, score: Math.round(normalizedScore * 100) / 100, confidence: Math.round(confidence * 100) / 100 };
};

/**
 * Classify sentiment from rating + text combined for higher accuracy.
 * @param {number} rating - 1-5 star rating
 * @param {string} text   - Comment text
 * @returns {'positive'|'neutral'|'negative'}
 */
const classifySentiment = (rating, text = '') => {
  const textResult = analyzeSentiment(text);

  // Weight rating heavier (60%) vs text (40%) for reliability
  let ratingScore;
  if (rating >= 4)      ratingScore = 0.7;
  else if (rating === 3) ratingScore = 0;
  else                  ratingScore = -0.7;

  const combined = ratingScore * 0.6 + textResult.score * 0.4;

  if (combined > 0.1)  return 'positive';
  if (combined < -0.1) return 'negative';
  return 'neutral';
};

/* ── Keyword / Tag Extraction ───────────────────────────────── */

/**
 * Extract domain-relevant keywords from text.
 * Returns matched domain keywords sorted by frequency, plus
 * top general words not already covered.
 *
 * @param {string[]} texts
 * @param {number}   topN
 * @returns {{ keyword: string, count: number, isDomain: boolean }[]}
 */
const extractKeywords = (texts, topN = 20) => {
  const freq = {};
  for (const text of texts) {
    const words = tokenize(text);
    for (const word of words) {
      freq[word] = (freq[word] || 0) + 1;
    }
  }

  const results = [];
  const seen = new Set();

  // Domain keywords first (highest signal)
  for (const kw of DOMAIN_KEYWORDS) {
    if (freq[kw]) {
      results.push({ keyword: kw, count: freq[kw], isDomain: true });
      seen.add(kw);
    }
  }

  // Then top general words
  const general = Object.entries(freq)
    .filter(([w]) => !seen.has(w) && !STOP_WORDS.has(w))
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN - results.length)
    .map(([keyword, count]) => ({ keyword, count, isDomain: false }));

  return [...results, ...general]
    .sort((a, b) => b.count - a.count)
    .slice(0, topN);
};

/* ── Phrase Extraction ──────────────────────────────────────── */

/**
 * Extract notable 2-word bigrams from texts.
 * @param {string[]} texts
 * @param {number}   topN
 * @returns {{ phrase: string, count: number }[]}
 */
const extractPhrases = (texts, topN = 8) => {
  const freq = {};
  for (const text of texts) {
    const words = tokenize(text);
    for (let i = 0; i < words.length - 1; i++) {
      const bigram = `${words[i]} ${words[i + 1]}`;
      freq[bigram] = (freq[bigram] || 0) + 1;
    }
  }
  return Object.entries(freq)
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([phrase, count]) => ({ phrase, count }));
};

/* ── Summary Generation ─────────────────────────────────────── */

/**
 * Generate a rich, human-readable AI summary paragraph.
 *
 * @param {string[]} comments
 * @param {string[]} suggestions
 * @param {{ positive: number, neutral: number, negative: number }} sentimentCounts
 * @param {number} avgRating
 * @returns {string}
 */
const generateSummary = (comments, suggestions, sentimentCounts = {}, avgRating = 0) => {
  const total = comments.length;
  if (total === 0) return 'No feedback has been submitted yet. Create an event and collect responses to generate AI insights.';

  const commentFreq    = getWordFrequency(comments);
  const suggestionFreq = getWordFrequency(suggestions);
  const topWords       = commentFreq.slice(0, 5).map((w) => w.word);
  const topSuggest     = suggestionFreq.slice(0, 3).map((w) => w.word);

  const pos = sentimentCounts.positive || 0;
  const neg = sentimentCounts.negative || 0;
  const neu = sentimentCounts.neutral  || 0;
  const posPercent = Math.round((pos / total) * 100);
  const negPercent = Math.round((neg / total) * 100);

  // Tone of opening sentence
  let opening;
  if (avgRating >= 4.5)      opening = 'Participants had an exceptional experience overall.';
  else if (avgRating >= 4.0)  opening = 'Participants responded positively overall.';
  else if (avgRating >= 3.5)  opening = 'Participants had a generally satisfactory experience.';
  else if (avgRating >= 3.0)  opening = 'Participants had a mixed experience.';
  else                        opening = 'Participants expressed significant concerns overall.';

  // Sentiment narrative
  let sentimentNarrative = '';
  if (posPercent >= 60) {
    sentimentNarrative = `<strong>${posPercent}%</strong> of feedback was positive`;
  } else if (negPercent >= 40) {
    sentimentNarrative = `<strong>${negPercent}%</strong> of responses raised concerns`;
  } else {
    sentimentNarrative = `Sentiment was balanced across responses`;
  }

  // Topics
  const topicStr   = topWords.length   ? `Key themes mentioned include <em>${topWords.join(', ')}</em>.` : '';
  const suggestStr = topSuggest.length ? `Areas suggested for improvement: <em>${topSuggest.join(', ')}</em>.` : '';

  return `${opening} ${sentimentNarrative} across ${total} response${total !== 1 ? 's' : ''}. ${topicStr} ${suggestStr}`.trim();
};

/* ── Top Suggestions ────────────────────────────────────────── */

/**
 * Extract top N suggestion phrases/words from suggestion texts.
 * @param {string[]} suggestions
 * @param {number}   topN
 * @returns {{ word: string, count: number }[]}
 */
const getTopSuggestions = (suggestions, topN = 8) => {
  // Try phrases first, fall back to words
  const phrases = extractPhrases(suggestions, topN);
  if (phrases.length >= 3) {
    return phrases.slice(0, topN).map((p) => ({ word: p.phrase, count: p.count }));
  }
  return getWordFrequency(suggestions).slice(0, topN);
};

/* ── Event Health Score ─────────────────────────────────────── */

/**
 * Compute a 0–100 event health score.
 *
 * Weights:
 *  - Rating (0–5)      × 40%  → 0–40 pts
 *  - NPS (0–10)        × 30%  → 0–30 pts
 *  - Sentiment ratio   × 30%  → 0–30 pts
 *
 * @param {{ avgRating: number, avgNPS: number }} stats
 * @param {{ positive: number, neutral: number, negative: number }} sentimentCounts
 * @returns {{ score: number, label: string, color: string }}
 */
const computeHealthScore = (stats, sentimentCounts = {}) => {
  const { avgRating = 0, avgNPS = 0 } = stats;
  const total   = (sentimentCounts.positive || 0) + (sentimentCounts.neutral || 0) + (sentimentCounts.negative || 0);
  const posRatio = total > 0 ? (sentimentCounts.positive || 0) / total : 0;

  const ratingPts    = (avgRating / 5) * 40;
  const npsPts       = (avgNPS    / 10) * 30;
  const sentimentPts = posRatio * 30;

  const score = Math.round(ratingPts + npsPts + sentimentPts);

  let label, color;
  if (score >= 80)      { label = 'Excellent';    color = '#059669'; }
  else if (score >= 65) { label = 'Good';         color = '#34D399'; }
  else if (score >= 50) { label = 'Satisfactory'; color = '#F59E0B'; }
  else if (score >= 35) { label = 'Needs Work';   color = '#F97316'; }
  else                  { label = 'Critical';     color = '#DC2626'; }

  return { score, label, color };
};

/* ── Trend Comparison ───────────────────────────────────────── */

/**
 * Compare current period stats against previous period stats.
 * @param {{ avgRating: number, avgNPS: number, totalResponses: number }} current
 * @param {{ avgRating: number, avgNPS: number, totalResponses: number }} previous
 * @returns {{ ratingDelta: number, npsDelta: number, responsesDelta: number, trending: 'up'|'down'|'stable' }}
 */
const computeTrend = (current, previous) => {
  if (!previous || !previous.totalResponses) {
    return { ratingDelta: 0, npsDelta: 0, responsesDelta: 0, trending: 'stable' };
  }

  const ratingDelta    = Math.round((current.avgRating    - previous.avgRating)    * 10) / 10;
  const npsDelta       = Math.round((current.avgNPS       - previous.avgNPS)       * 10) / 10;
  const responsesDelta = current.totalResponses - previous.totalResponses;

  const trending =
    ratingDelta > 0.2 ? 'up'   :
    ratingDelta < -0.2 ? 'down' : 'stable';

  return { ratingDelta, npsDelta, responsesDelta, trending };
};

module.exports = {
  tokenize,
  getWordFrequency,
  analyzeSentiment,
  classifySentiment,
  extractKeywords,
  extractPhrases,
  generateSummary,
  getTopSuggestions,
  computeHealthScore,
  computeTrend,
};
