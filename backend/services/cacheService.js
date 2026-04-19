/**
 * cacheService.js — Lightweight in-memory caching layer.
 *
 * Uses `node-cache` for TTL-based key-value storage.
 * Suitable for caching dashboard stats and report summaries that
 * are expensive to recompute from aggregation pipelines.
 *
 * TTLs:
 *   DASHBOARD_TTL  = 60  seconds (refresh every minute)
 *   REPORT_TTL     = 120 seconds (heavier, refresh every 2 min)
 */

const NodeCache = require('node-cache');

// stdTTL = default TTL in seconds; checkperiod = GC interval
const cache = new NodeCache({ stdTTL: 60, checkperiod: 30, useClones: false });

const DASHBOARD_TTL = 60;
const REPORT_TTL    = 120;
const AI_TTL        = 120;

/**
 * Get a value from cache.
 * @returns cached value or undefined on miss
 */
const get = (key) => cache.get(key);

/**
 * Set a value with an explicit TTL.
 * @param {string} key
 * @param {any}    value
 * @param {number} [ttl]  - seconds (uses NodeCache default if omitted)
 */
const set = (key, value, ttl) => {
  if (ttl !== undefined) {
    cache.set(key, value, ttl);
  } else {
    cache.set(key, value);
  }
};

/**
 * Delete a specific key.
 */
const del = (key) => cache.del(key);

/**
 * Invalidate all cache keys that start with a given prefix.
 * Useful for busting organizer-scoped cache on data mutations.
 *
 * @param {string} prefix  e.g. 'dashboard:' or 'report:'
 */
const invalidatePrefix = (prefix) => {
  const keys = cache.keys().filter((k) => k.startsWith(prefix));
  if (keys.length) cache.del(keys);
};

/**
 * Cache-aside helper. Returns cached value if present,
 * otherwise runs `fn`, caches the result, and returns it.
 *
 * @param {string}   key
 * @param {Function} fn   - Async function that returns the value to cache
 * @param {number}   [ttl]
 * @returns {Promise<any>}
 */
const getOrSet = async (key, fn, ttl) => {
  const cached = cache.get(key);
  if (cached !== undefined) return cached;

  const value = await fn();
  set(key, value, ttl);
  return value;
};

/**
 * Build a per-organizer cache key for dashboard stats.
 */
const dashboardKey = (organizerId) => `dashboard:${organizerId}`;
const reportKey    = (organizerId) => `report:${organizerId}`;
const aiKey        = (organizerId) => `ai:${organizerId}`;

module.exports = {
  get,
  set,
  del,
  invalidatePrefix,
  getOrSet,
  dashboardKey,
  reportKey,
  aiKey,
  DASHBOARD_TTL,
  REPORT_TTL,
  AI_TTL,
};
