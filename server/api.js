// The /api/* endpoints the page calls for card search, card details, market prices and price history.
const catalog = require('./catalog');
const ingest = require('./ingest');

const MAX_BODY = 256 * 1024;
const send = (res, code, body, cache) => {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': cache || 'no-store' });
  res.end(JSON.stringify(body));
};
const readBody = req => new Promise((resolve, reject) => {
  let size = 0; const parts = [];
  req.on('data', d => { size += d.length; if (size > MAX_BODY) { reject(Object.assign(new Error('Request too large'), { code: 413 })); req.destroy(); } else parts.push(d); });
  req.on('end', () => { try { resolve(parts.length ? JSON.parse(Buffer.concat(parts).toString('utf8')) : {}); } catch (e) { reject(Object.assign(new Error('Bad JSON'), { code: 400 })); } });
  req.on('error', reject);
});

// A light per-visitor limit so one page can't hammer the card sites through us: 120 requests a minute.
const hits = new Map();
function limited(req) {
  const ip = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
  const now = Date.now(), h = hits.get(ip) || { n: 0, at: now };
  if (now - h.at > 60e3) { h.n = 0; h.at = now; }
  h.n++; hits.set(ip, h);
  if (hits.size > 5000) for (const [k, v] of hits) if (now - v.at > 60e3) hits.delete(k);
  return h.n > 120;
}

const ROUTES = {
  'GET /api/search': (q) => catalog.search({ q: q.get('q'), game: q.get('game'), limit: q.get('limit') }).then(r => [200, r, 'public, max-age=300']),
  'GET /api/prints': (q) => catalog.prints({ game: q.get('game'), name: q.get('name') }).then(r => [200, r, 'public, max-age=3600']),
  'POST /api/enrich': async (q, body) => {
    const cards = Array.isArray(body.cards) ? body.cards : [];
    return [200, { cards: await catalog.enrich(cards, { withDetails: cards.length <= 3 }) }];
  },
  'POST /api/prices': async (q, body) => [200, { prices: await catalog.latest(body.items) }],
  'POST /api/history': async (q, body) => [200, { series: await catalog.history(body.items, body.days) }],
  'GET /api/catalog/status': async () => [200, await catalog.status()],
  // Starts a card database load by hand. Needs the TX_ADMIN_TOKEN setting, sent as the x-admin-token header.
  'POST /api/catalog/ingest': async (q, body, req) => {
    const token = process.env.TX_ADMIN_TOKEN;
    if (!token || req.headers['x-admin-token'] !== token) return [403, { error: 'Not allowed' }];
    ingest.run({ force: q.get('force') === '1', always: true }).catch(e => console.log('[catalog] run failed:', e.message));
    return [202, { started: true }];
  },
  // No free source has live marketplace listings; the page shows its own message and links out instead.
  'GET /api/listings': async () => [501, { error: 'Live listings are not available' }],
};

async function handle(req, res) {
  const u = new URL(req.url, 'http://x');
  const route = ROUTES[req.method + ' ' + u.pathname.replace(/\/$/, '')];
  if (!route) return send(res, 404, { error: 'Not found' });
  if (limited(req)) return send(res, 429, { error: 'Too many requests. Try again in a minute.' });
  try {
    const body = req.method === 'POST' ? await readBody(req) : {};
    const [code, out, cache] = await route(u.searchParams, body || {}, req);
    send(res, code, out, code === 200 ? cache : undefined);
  } catch (e) {
    console.log('[api]', u.pathname, e.message);
    send(res, e.code >= 400 && e.code < 500 ? e.code : 502, { error: e.code ? e.message : 'The card data source didn’t answer. Try again shortly.' });
  }
}

module.exports = { handle };
