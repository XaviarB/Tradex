// Small fetch helpers for the card data sources: JSON with a timeout, a polite User-Agent,
// an in-memory cache, and a limit on how many requests run at once per host.
const UA = 'Tradex/1.0 (+https://tradex-production-1b9b.up.railway.app)';

const cache = new Map();
const MAX_CACHE = 2000;
function remember(key, value, ttl) {
  if (cache.size >= MAX_CACHE) cache.delete(cache.keys().next().value);
  cache.set(key, { value, until: Date.now() + ttl });
}

const queues = new Map();
async function slot(host, limit) {
  const q = queues.get(host) || { active: 0, waiting: [] };
  queues.set(host, q);
  if (q.active >= limit) await new Promise(res => q.waiting.push(res));
  q.active++;
  return () => { q.active--; const next = q.waiting.shift(); if (next) next(); };
}

class HttpError extends Error {
  constructor(status, url, body) { super('HTTP ' + status + ' from ' + new URL(url).host); this.status = status; this.body = body; }
}

// getJSON(url, { ttl, timeout, headers, limit }) -> parsed JSON. ttl in ms caches successful answers.
async function getJSON(url, opt = {}) {
  const key = opt.cacheKey || url;
  if (opt.ttl) {
    const hit = cache.get(key);
    if (hit && hit.until > Date.now()) return hit.value;
  }
  const release = await slot(new URL(url).host, opt.limit || 4);
  try {
    const res = await fetch(url, {
      method: opt.method || 'GET',
      headers: { 'User-Agent': UA, Accept: 'application/json', ...(opt.body ? { 'Content-Type': 'application/json' } : {}), ...opt.headers },
      body: opt.body ? JSON.stringify(opt.body) : undefined,
      signal: AbortSignal.timeout(opt.timeout || 15000),
    });
    const text = await res.text();
    if (!res.ok) throw new HttpError(res.status, url, text.slice(0, 300));
    const value = text ? JSON.parse(text) : null;
    if (opt.ttl) remember(key, value, opt.ttl);
    return value;
  } finally { release(); }
}

const sleep = ms => new Promise(res => setTimeout(res, ms));

// Runs fn over items with at most n in flight; keeps the input order.
async function mapLimit(items, n, fn) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) { const k = i++; out[k] = await fn(items[k], k); }
  }));
  return out;
}

module.exports = { getJSON, HttpError, sleep, mapLimit, UA, _cache: cache };
