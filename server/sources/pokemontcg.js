// Pokémon TCG API (pokemontcg.io): free Pokémon card data with images, attacks, artists, and TCGplayer
// and Cardmarket prices. Works without a key at a lower rate limit; set POKEMONTCG_API_KEY for more.
const { getJSON } = require('../http');
const BASE = () => (process.env.POKEMONTCG_BASE || 'https://api.pokemontcg.io').replace(/\/$/, '');
const HOUR = 36e5;
const SUB = { normal: 'Normal', holofoil: 'Holofoil', reverseHolofoil: 'Reverse Holofoil', '1stEditionHolofoil': '1st Edition Holofoil', '1stEditionNormal': '1st Edition', unlimitedHolofoil: 'Unlimited Holofoil' };
const head = () => (process.env.POKEMONTCG_API_KEY ? { 'X-Api-Key': process.env.POKEMONTCG_API_KEY } : {});
const quote = s => '"' + String(s).replace(/["\\]/g, ' ').trim() + '"';

function norm(c) {
  const tp = (c.tcgplayer || {}).prices || {}, cm = (c.cardmarket || {}).prices || {}, prices = {};
  for (const k in tp) prices[SUB[k] || k] = { market: tp[k].market ?? null, low: tp[k].low ?? null, mid: tp[k].mid ?? null, high: tp[k].high ?? null };
  const first = Object.values(prices).find(p => p.market != null);
  const sources = [];
  if (first) sources.push({ site: 'TCGplayer', label: 'Market', price: first.market, cur: 'USD', url: (c.tcgplayer || {}).url || undefined });
  const eur = cm.trendPrice ?? cm.averageSellPrice;
  if (eur) sources.push({ site: 'Cardmarket', label: 'Trend', price: eur, cur: 'EUR', url: (c.cardmarket || {}).url || undefined });
  const set = c.set || {};
  return {
    id: 'ptcg:' + c.id, tcg: null, game: 'Pokémon', origin: 'pokemontcg',
    name: c.name, set: set.name || null, setCode: set.ptcgoCode || set.id || null,
    num: c.number && set.printedTotal ? c.number + '/' + set.printedTotal : c.number || null,
    year: set.releaseDate ? set.releaseDate.replace(/\//g, '-') : null, rarity: c.rarity || null,
    type: [c.supertype, ...(c.subtypes || [])].filter(Boolean).join(' — ') + (c.types ? ' · ' + c.types.join('/') : ''),
    text: (c.rules || []).join('\n') || null,
    // The app's move format (see js/card-symbols.js): abilities first, then attacks.
    moves: [...(c.abilities || []).map(a => ({ kind: 'power', label: a.type || 'Ability', name: a.name, text: a.text || '' })),
      ...(c.attacks || []).map(a => ({ kind: 'attack', name: a.name, cost: a.cost || [], text: a.text || '', damage: a.damage || '' }))],
    hp: c.hp || null, flavor: c.flavorText || null, artist: c.artist || null,
    img: (c.images || {}).large || null, imgSm: (c.images || {}).small || null,
    url: (c.tcgplayer || {}).url || null, prices, sources,
  };
}

async function search(q, limit = 20) {
  const words = String(q).trim().split(/\s+/).filter(Boolean);
  const numW = words.find(w => /^\d+(\/\d+)?$/.test(w));
  const name = words.filter(w => w !== numW).join(' ');
  if (!name) return [];
  const parts = ['name:' + quote(name + '*')];
  if (numW) parts.push('number:' + numW.split('/')[0].replace(/^0+(?=\d)/, ''));
  const url = BASE() + '/v2/cards?pageSize=' + limit + '&orderBy=-set.releaseDate&q=' + encodeURIComponent(parts.join(' '));
  const j = await getJSON(url, { ttl: HOUR, headers: head(), timeout: 20000, limit: 3 });
  return (j.data || []).map(norm);
}

async function details(c) {
  const base = String(c.num || '').split('/')[0].replace(/^0+(?=\d)/, '');
  const q = 'name:' + quote(c.name) + (base ? ' number:' + base : '');
  const j = await getJSON(BASE() + '/v2/cards?pageSize=30&q=' + encodeURIComponent(q), { ttl: 12 * HOUR, headers: head(), timeout: 20000, limit: 3 });
  const L = (j.data || []).map(norm), set = String(c.set || '').toLowerCase();
  return L.find(x => (x.set || '').toLowerCase() === set) || L[0] || null;
}

module.exports = { search, details, norm };
