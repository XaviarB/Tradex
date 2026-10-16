// A local stand-in for TCGCSV, Scryfall, the Pokémon TCG API, YGOPRODeck and Supabase's REST API,
// so tests (and screenshots) run without the internet. Response shapes follow each service's documented format;
// the cards and prices are test data. Supabase is a tiny in-memory imitation of the PostgREST calls the server makes.
const http = require('http');
const F = require('./fixtures');

function start(opt = {}) {
  const tables = { catalog_sets: [], catalog_cards: [], catalog_prices: [], price_history: [], card_details: [], catalog_meta: [], cards: [] };
  const calls = [];
  const keys = { catalog_sets: ['group_id'], catalog_cards: ['product_id'], catalog_prices: ['product_id', 'sub'], price_history: ['product_id', 'sub', 'day'], card_details: ['key'], catalog_meta: ['key'] };
  let tcgcsvBuild = opt.build || '2026-10-15T20:05:00+0000';
  const archives = {};

  const json = (res, code, body) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(body)); };
  const read = req => new Promise(r => { let b = ''; req.on('data', d => (b += d)); req.on('end', () => r(b ? JSON.parse(b) : null)); });

  function filterRows(rows, q) {
    for (const [k, v] of q) {
      if (['select', 'limit', 'offset', 'order', 'on_conflict'].includes(k)) continue;
      const m = /^(eq|in|gte)\.(.*)$/.exec(v);
      if (!m) continue;
      if (m[1] === 'eq') rows = rows.filter(r => String(r[k]) === m[2]);
      if (m[1] === 'gte') rows = rows.filter(r => String(r[k]) >= m[2]);
      if (m[1] === 'in') { const set = new Set(m[2].replace(/^\(|\)$/g, '').split(',')); rows = rows.filter(r => set.has(String(r[k]))); }
    }
    const ord = /^(\w+)\.(asc|desc)/.exec(q.get('order') || '');
    if (ord) rows = [...rows].sort((a, b) => String(a[ord[1]] ?? '').localeCompare(String(b[ord[1]] ?? '')) * (ord[2] === 'desc' ? -1 : 1));
    const off = +(q.get('offset') || 0), lim = +(q.get('limit') || 1000);
    return rows.slice(off, off + lim);
  }
  const withPrices = r => ({ ...r, catalog_prices: tables.catalog_prices.filter(p => p.product_id === r.product_id) });
  const searchText = r => [r.name, r.set_name, r.set_code, r.number].filter(Boolean).join(' ').toLowerCase();

  async function supabase(req, res, path, q) {
    calls.push(req.method + ' ' + path);
    if (opt.noCatalog && /catalog|price|search/.test(path)) return json(res, 404, { code: 'PGRST202', message: 'Could not find the function' });
    const body = req.method === 'POST' ? await read(req) : null;
    if (path === 'rpc/search_catalog') {
      const words = String(body.q).toLowerCase().trim().split(/\s+/);
      const L = tables.catalog_cards.filter(r => (!body.g || r.game === body.g) && words.every(w => searchText(r).includes(w)))
        .sort((a, b) => (b.name.toLowerCase() === body.q.toLowerCase()) - (a.name.toLowerCase() === body.q.toLowerCase()) || String(b.released).localeCompare(String(a.released)));
      return json(res, 200, L.slice(0, body.lim).map(r => {
        const pr = {}; for (const p of tables.catalog_prices.filter(p => p.product_id === r.product_id)) pr[p.sub] = { market: p.market, low: p.low, mid: p.mid, high: p.high, day: p.day };
        return { ...r, prices: Object.keys(pr).length ? pr : null };
      }));
    }
    if (path === 'rpc/price_series') {
      const out = {};
      for (const h of tables.price_history) if (body.ids.includes(h.product_id) && h.day >= body.since) (out[h.product_id + '|' + h.sub] = out[h.product_id + '|' + h.sub] || []).push(h);
      return json(res, 200, Object.values(out).map(L => { L.sort((a, b) => a.day.localeCompare(b.day)); return { product_id: L[0].product_id, sub: L[0].sub, days: L.map(x => x.day), market: L.map(x => x.market) }; }));
    }
    if (path === 'tracked_products') {
      const ids = [...new Set(tables.cards.map(c => c.extra && c.extra.src && c.extra.src.tcg).filter(Boolean))];
      return json(res, 200, filterRows(ids.map(product_id => ({ product_id })), q));
    }
    const t = tables[path];
    if (!t) return json(res, 404, { message: 'no table ' + path });
    if (req.method === 'GET') {
      const rows = filterRows(t, q);
      return json(res, 200, String(q.get('select') || '').includes('catalog_prices(') ? rows.map(withPrices) : rows);
    }
    if (path === 'catalog_prices') {
      const missing = body.find(r => !tables.catalog_cards.some(c => c.product_id === r.product_id));
      if (missing) return json(res, 409, { code: '23503', message: 'insert or update on table "catalog_prices" violates foreign key constraint' });
    }
    for (const row of body) {
      const k = keys[path], i = t.findIndex(r => k.every(c => r[c] === row[c]));
      if (i >= 0) t[i] = { ...t[i], ...row }; else t.push({ ...row });
    }
    res.writeHead(201); return res.end();
  }

  const server = http.createServer(async (req, res) => {
    const u = new URL(req.url, 'http://x'), p = u.pathname;
    if (p.startsWith('/supabase/rest/v1/')) return supabase(req, res, p.slice('/supabase/rest/v1/'.length), u.searchParams);
    calls.push('GET ' + p + u.search);
    let m;
    if ((m = /^\/tcgcsv\/archive\/tcgplayer\/prices-(\d{4}-\d{2}-\d{2})\.ppmd\.7z$/.exec(p))) { if (!archives[m[1]]) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'Content-Type': 'application/x-7z-compressed' }); return res.end(Buffer.from(archives[m[1]])); }
    if (p === '/tcgcsv/last-updated.txt') { res.writeHead(200); return res.end(tcgcsvBuild); }
    if ((m = /^\/tcgcsv\/tcgplayer\/(\d+)\/groups$/.exec(p))) return json(res, 200, { success: true, errors: [], results: F.groups[m[1]] || [] });
    if ((m = /^\/tcgcsv\/tcgplayer\/(\d+)\/(\d+)\/products$/.exec(p))) return json(res, 200, { success: true, errors: [], results: F.products[m[2]] || [] });
    if ((m = /^\/tcgcsv\/tcgplayer\/(\d+)\/(\d+)\/prices$/.exec(p))) return json(res, 200, { success: true, errors: [], results: (F.prices[m[2]] || []).map(x => ({ ...x, marketPrice: x.marketPrice == null ? null : +(x.marketPrice * (opt.priceFactor || 1)).toFixed(2) })) });
    if (p === '/scryfall/cards/search') { const L = F.scryfall.filter(c => c.name.toLowerCase().includes(u.searchParams.get('q').replace(/!|"|cn:\S+/g, '').trim().toLowerCase())); return L.length ? json(res, 200, { object: 'list', data: L }) : json(res, 404, { object: 'error', code: 'not_found' }); }
    if ((m = /^\/scryfall\/cards\/tcgplayer\/(\d+)$/.exec(p))) { const c = F.scryfall.find(c => String(c.tcgplayer_id) === m[1]); return c ? json(res, 200, c) : json(res, 404, { object: 'error' }); }
    if (p === '/pokemontcg/v2/cards') { const q = u.searchParams.get('q'), nm = (/name:"([^"*]+)/.exec(q) || [])[1] || ''; return json(res, 200, { data: F.pokemontcg.filter(c => c.name.toLowerCase().startsWith(nm.toLowerCase().trim())) }); }
    if (p === '/ygoprodeck/api/v7/cardinfo.php') { const f = (u.searchParams.get('fname') || u.searchParams.get('name') || '').toLowerCase(); const L = F.ygo.filter(c => c.name.toLowerCase().includes(f)); return L.length ? json(res, 200, { data: L }) : json(res, 400, { error: 'No card matching your query was found in the database.' }); }
    json(res, 404, { error: 'mock: unknown ' + p });
  });

  return new Promise(resolve => server.listen(0, '127.0.0.1', () => {
    const base = 'http://127.0.0.1:' + server.address().port;
    resolve({
      base, tables, calls, setBuild: b => { tcgcsvBuild = b; }, setArchive: (day, bytes) => { archives[day] = bytes; }, setPriceFactor: f => { opt.priceFactor = f; },
      env: { TCGCSV_BASE: base + '/tcgcsv', SCRYFALL_BASE: base + '/scryfall', POKEMONTCG_BASE: base + '/pokemontcg', YGOPRODECK_BASE: base + '/ygoprodeck', SUPABASE_URL: base + '/supabase' },
      close: () => new Promise(r => server.close(r)),
    });
  }));
}

module.exports = { start };
