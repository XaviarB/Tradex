// Card lookups for the app: search, other printings, card details and prices, and price history.
// The Supabase card database (filled nightly from TCGCSV, see ingest.js) answers first. When it isn't set up
// or has no match, Magic, Pokémon and Yu-Gi-Oh! searches go live to Scryfall, the Pokémon TCG API and YGOPRODeck.
const db = require('./supabase');
const tcgcsv = require('./sources/tcgcsv');
const scryfall = require('./sources/scryfall');
const pokemontcg = require('./sources/pokemontcg');
const ygoprodeck = require('./sources/ygoprodeck');
const { gameOf, subFor, fold, GAMES } = require('./games');
const { mapLimit } = require('./http');

const LIVE = { Magic: scryfall, 'Pokémon': pokemontcg, 'Yu-Gi-Oh!': ygoprodeck };
const DETAILS_DAYS = 7;
const log = (...a) => console.log('[cards]', ...a);

// The price sub-type a card shows by default: Normal when it has a price, else the first priced one.
function mainSub(prices) {
  const keys = Object.keys(prices || {}).filter(k => prices[k] && prices[k].market != null);
  return keys.includes('Normal') ? 'Normal' : keys[0] || Object.keys(prices || {})[0] || null;
}

const priceMap = list => {
  const out = {};
  for (const p of list || []) out[p.sub] = { market: num(p.market), low: num(p.low), mid: num(p.mid), high: num(p.high), day: p.day || null };
  return out;
};
const num = v => (v == null || v === '' || !isFinite(+v) ? null : +v);

// A catalog row (from search_catalog, or catalog_cards with catalog_prices embedded) as the app's card shape.
function fromRow(r) {
  const prices = r.prices && !Array.isArray(r.prices) ? Object.fromEntries(Object.entries(r.prices).map(([k, p]) => [k, { market: num(p.market), low: num(p.low), mid: num(p.mid), high: num(p.high), day: p.day || null }])) : priceMap(r.catalog_prices);
  const sub = mainSub(prices);
  return {
    id: 'tcg:' + r.product_id, tcg: +r.product_id, game: r.game, origin: 'tcgplayer',
    name: r.name, set: r.set_name, setCode: r.set_code, num: r.number, rarity: r.rarity, type: r.card_type,
    year: r.released || null, img: tcgcsv.image(r.image_url), imgSm: r.image_url, url: r.url,
    prices, sub, price: sub && prices[sub] ? prices[sub].market : null,
  };
}

// Live results already carry prices; add the defaults the catalog results have.
const fromLive = c => { const sub = mainSub(c.prices); return { ...c, sub, price: sub && c.prices[sub] ? c.prices[sub].market : (c.sources[0] || {}).price ?? null }; };

async function liveSearch(q, game, limit) {
  const srcs = game ? (LIVE[game.name] ? [LIVE[game.name]] : []) : Object.values(LIVE);
  if (!srcs.length) return [];
  const got = await Promise.allSettled(srcs.map(s => s.search(q, limit)));
  const lists = got.filter(x => x.status === 'fulfilled').map(x => x.value);
  if (!lists.length) throw got[0].reason;
  const out = [];
  for (let i = 0; out.length < limit && lists.some(l => l[i]); i++) for (const l of lists) if (l[i] && out.length < limit) out.push(fromLive(l[i]));
  return out;
}

async function search({ q, game, limit = 24 }) {
  q = String(q || '').trim().slice(0, 120);
  if (q.length < 2) return { cards: [], from: null };
  const g = gameOf(game);
  limit = Math.min(Math.max(+limit || 24, 1), 60);
  if (db.readable()) {
    try {
      const rows = await db.rpc('search_catalog', { q, g: g ? g.name : null, lim: limit });
      if (rows && rows.length) return { cards: rows.map(fromRow), from: 'catalog' };
    } catch (e) { log('catalog search failed, trying live sources:', e.message); }
  }
  return { cards: await liveSearch(q, g, limit), from: 'live' };
}

const CARD_SELECT = 'select=*,catalog_prices(sub,day,market,low,mid,high)';
async function product(id) {
  if (!db.readable() || !/^\d+$/.test(String(id))) return null;
  const rows = await db.select('catalog_cards', CARD_SELECT + '&product_id=eq.' + id);
  return rows && rows[0] ? fromRow(rows[0]) : null;
}

// Every printing of a card in one game, newest first.
async function prints({ game, name }) {
  const g = gameOf(game);
  if (!g || !name) return [];
  if (db.readable()) {
    try {
      const rows = await db.select('catalog_cards', CARD_SELECT + '&game=eq.' + encodeURIComponent(g.name) + '&name=eq.' + encodeURIComponent(name) + '&order=released.desc.nullslast&limit=200');
      if (rows && rows.length) return rows.map(fromRow).map(c => ({ ...c, sources: tcgSources(c, c.sub) }));
    } catch (e) { log('prints from catalog failed:', e.message); }
  }
  const live = LIVE[g.name];
  if (!live) return [];
  const L = await live.search(g.name === 'Magic' ? '!"' + name.replace(/"/g, '') + '"' : name, 60);
  return L.filter(c => fold(c.name) === fold(name)).map(fromLive);
}

const baseNum = n => String(n || '').trim().toLowerCase().split('/')[0].replace(/^[a-z]*0*(?=\d)/, m => m.replace(/0+$/, ''));
// The catalog card that best matches a card someone typed in or imported.
function bestMatch(c, list) {
  const nm = fold(c.name), set = fold(c.set), n = baseNum(c.num);
  const same = list.filter(x => fold(x.name) === nm);
  const score = x => (set && fold(x.set) === set ? 2 : set && (fold(x.setCode) === set) ? 2 : 0) + (n && baseNum(x.num) === n ? 3 : 0);
  const pool = same.length ? same : list.filter(x => fold(x.name).startsWith(nm));
  return pool.sort((a, b) => score(b) - score(a))[0] || null;
}

// Market boxes for the card detail view: TCGplayer market and low for the card's finish.
function tcgSources(c, sub) {
  const p = (c.prices || {})[sub] || {};
  const out = [];
  if (p.market != null) out.push({ site: 'TCGplayer', label: 'Market' + (sub && sub !== 'Normal' ? ' · ' + sub : ''), price: p.market, cur: 'USD' });
  if (p.low != null) out.push({ site: 'TCGplayer low', label: 'Lowest listing', price: p.low, cur: 'USD' });
  return out;
}

// Bumped when the details format changes, so older cached details are fetched again.
const DETAILS_V = 'v3:';
async function cachedDetails(key, fetcher) {
  key = DETAILS_V + key;
  if (db.readable()) {
    try {
      const r = await db.select('card_details', 'select=data,fetched_at&key=eq.' + encodeURIComponent(key));
      if (r && r[0] && Date.now() - new Date(r[0].fetched_at) < DETAILS_DAYS * 864e5) return r[0].data;
    } catch (e) { /* table not created yet */ }
  }
  const data = await fetcher();
  // Details missing a source that failed this time are not kept, so the next look tries again.
  if (data && data.partial) { delete data.partial; return data; }
  if (data && db.writable()) db.upsert('card_details', [{ key, data, fetched_at: new Date().toISOString() }], 'key').catch(() => {});
  return data;
}

// Rules text, artist and Cardmarket prices from the game's own database, plus TCGplayer's card text.
async function details(c) {
  const key = c.tcg ? 'tcg:' + c.tcg : [c.game, c.name, c.set, c.num].map(fold).join('|');
  return cachedDetails(key, async () => {
    const out = {};
    const g = gameOf(c.game);
    if (c.tcg && g) {
      try {
        const row = await db.select('catalog_cards', 'select=group_id&product_id=eq.' + c.tcg);
        const p = row && row[0] && (await tcgcsv.products(g.cat, row[0].group_id)).find(x => x.productId === c.tcg);
        if (p) Object.assign(out, strip(tcgcsv.detailsOf(p)));
      } catch (e) { log('TCGplayer details failed:', e.message); }
    }
    const live = g && LIVE[g.name];
    if (live) {
      try {
        const x = await live.details(c);
        if (x) {
          for (const k of ['flavor', 'artist', 'cost', 'type']) if (x[k]) out[k] = out[k] || x[k];
          // Keep whichever list has every ability and attack; the game's own database wins a tie.
          if (x.moves && x.moves.length && x.moves.length >= (out.moves || []).length) { out.moves = x.moves; if (x.text || !out.text) out.text = x.text || null; }
          else if (x.text && (!out.text || (!out.moves && x.text.length > out.text.length))) out.text = x.text;
          out.img2 = x.img;
          out.extraSources = (x.sources || []).filter(s => s.site !== 'TCGplayer');
          if (!c.tcg && x.sources.length) out.liveSources = x.sources;
        }
      } catch (e) { log('live details failed:', e.message); out.partial = true; }
    }
    return Object.keys(out).filter(k => k !== 'partial').length ? strip(out) : null;
  });
}
const strip = o => Object.fromEntries(Object.entries(o).filter(([, v]) => v != null && v !== ''));

// For each card the app sends ({game, name, set, num, finish, tcg?, sub?}): the catalog card it is,
// its prices, and (when withDetails) rules text and other markets.
async function enrich(cards, { withDetails = false } = {}) {
  return mapLimit(cards.slice(0, 60), 6, async c => {
    try {
      let m = c.tcg ? await product(c.tcg) : null;
      if (!m && c.name) {
        const q = [c.name, baseNum(c.num)].filter(Boolean).join(' ');
        const r = await search({ q, game: c.game, limit: 30 }).catch(() => ({ cards: [] }));
        m = bestMatch(c, r.cards) || (c.num ? bestMatch({ ...c, num: '' }, (await search({ q: c.name, game: c.game, limit: 40 })).cards) : null);
      }
      if (!m) return null;
      const subs = Object.keys(m.prices || {});
      const sub = c.sub && subs.includes(c.sub) ? c.sub : subFor(m.game, c.finish, subs) || m.sub;
      const out = {
        id: m.id, tcg: m.tcg, sub, game: m.game, name: m.name, set: m.set, num: m.num, rarity: m.rarity, type: m.type, year: m.year,
        img: m.img, url: m.url, prices: m.prices, price: sub && m.prices[sub] ? m.prices[sub].market : m.price,
        sources: m.tcg ? tcgSources(m, sub) : m.sources || [],
        text: m.text, flavor: m.flavor, artist: m.artist, cost: m.cost, moves: m.moves,
      };
      if (withDetails) {
        const d = await details({ ...out, game: m.game }).catch(() => null);
        if (d) {
          for (const k of ['flavor', 'artist', 'cost']) if (!out[k] && d[k]) out[k] = d[k];
          if (d.moves && d.moves.length > (out.moves || []).length) { out.moves = d.moves; out.text = d.text; }
          else if (d.text && (!out.text || (!(out.moves || []).length && d.text.length > out.text.length))) out.text = d.text;
          if (!out.type && d.type) out.type = d.type;
          if (!out.img && d.img2) out.img = d.img2;
          out.sources = [...out.sources, ...(d.extraSources || [])];
        }
      }
      return strip(out);
    } catch (e) { log('enrich failed for', c.name, e.message); return null; }
  });
}

const parseItems = items => (Array.isArray(items) ? items : []).slice(0, 2000)
  .map(x => ({ tcg: parseInt(x && x.tcg, 10), sub: x && x.sub ? String(x.sub).slice(0, 60) : null })).filter(x => x.tcg > 0);

// Today's market price for each {tcg, sub}: { "42346|Holofoil": { market, low, day } }.
async function latest(items) {
  const L = parseItems(items), ids = [...new Set(L.map(x => x.tcg))], out = {};
  if (!ids.length || !db.readable()) return out;
  for (let i = 0; i < ids.length; i += 150) {
    const rows = await db.select('catalog_prices', 'select=product_id,sub,day,market,low&product_id=in.(' + ids.slice(i, i + 150).join(',') + ')&limit=1000');
    for (const r of rows) out[r.product_id + '|' + r.sub] = { market: num(r.market), low: num(r.low), day: r.day };
  }
  // A card whose sub-type has no price row falls back to the product's main price.
  for (const x of L) if (!out[x.tcg + '|' + x.sub]) {
    const keys = Object.keys(out).filter(k => k.startsWith(x.tcg + '|')), pick = keys.find(k => k.endsWith('|Normal')) || keys[0];
    if (pick) out[x.tcg + '|' + x.sub] = { ...out[pick], sub: pick.split('|')[1] };
  }
  return out;
}

// Daily prices since `days` ago: { "42346|Holofoil": { d: ['2026-10-01', ...], v: [70.8, ...] } }.
async function history(items, days = 365) {
  const L = parseItems(items), ids = [...new Set(L.map(x => x.tcg))], out = {};
  if (!ids.length || !db.readable()) return out;
  const since = new Date(Date.now() - Math.min(Math.max(+days || 365, 7), 3650) * 864e5).toISOString().slice(0, 10);
  for (let i = 0; i < ids.length; i += 500) {
    const rows = await db.rpc('price_series', { ids: ids.slice(i, i + 500), since });
    for (const r of rows || []) out[r.product_id + '|' + r.sub] = { d: r.days, v: (r.market || []).map(Number) };
  }
  return out;
}

async function status() {
  const out = { catalog: db.readable(), writer: db.writable(), games: GAMES.length };
  if (db.writable()) {
    try {
      const r = await db.select('catalog_meta', 'select=key,value&key=in.(last_run,backfill)'), m = k => (r.find(x => x.key === k) || {}).value || null;
      out.lastRun = m('last_run');
      const b = m('backfill');
      out.history = b ? { at: b.at, cards: (b.ids || []).length, last: b.last } : null;
    }
    catch (e) { out.error = e.message; }
  }
  return out;
}

module.exports = { search, prints, enrich, latest, history, product, details, status, bestMatch, fromRow, mainSub };
