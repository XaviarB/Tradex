// Scryfall (scryfall.com): free Magic: The Gathering data with images, rules text, artists and daily
// TCGplayer (USD) and Cardmarket (EUR) prices. Every Scryfall card carries its TCGplayer product id.
// House rules: send a User-Agent and Accept header, keep to about 10 requests a second.
const { getJSON, HttpError } = require('../http');
const BASE = () => (process.env.SCRYFALL_BASE || 'https://api.scryfall.com').replace(/\/$/, '');
const HOUR = 36e5;
const RAR = { common: 'Common', uncommon: 'Uncommon', rare: 'Rare', mythic: 'Mythic', special: 'Special', bonus: 'Bonus' };
const num = v => (v == null || v === '' || !isFinite(+v) ? null : +v);

function norm(c) {
  const face = (c.card_faces || [])[0] || {}, im = c.image_uris || face.image_uris || {}, p = c.prices || {};
  const prices = {};
  if (num(p.usd) != null) prices.Normal = { market: num(p.usd) };
  if (num(p.usd_foil) != null) prices.Foil = { market: num(p.usd_foil) };
  if (num(p.usd_etched) != null) prices['Etched Foil'] = { market: num(p.usd_etched) };
  const sources = [];
  const usd = num(p.usd) ?? num(p.usd_foil);
  if (usd != null) sources.push({ site: 'TCGplayer', label: 'Market', price: usd, cur: 'USD', url: (c.purchase_uris || {}).tcgplayer || undefined });
  const eur = num(p.eur) ?? num(p.eur_foil);
  if (eur != null) sources.push({ site: 'Cardmarket', label: 'Trend', price: eur, cur: 'EUR', url: (c.purchase_uris || {}).cardmarket || undefined });
  return {
    id: 'scryfall:' + c.id, tcg: c.tcgplayer_id || null, game: 'Magic', origin: 'scryfall',
    name: c.name, set: c.set_name, setCode: (c.set || '').toUpperCase(), num: c.collector_number, year: c.released_at || null,
    rarity: RAR[c.rarity] || c.rarity || null, type: c.type_line || face.type_line || null,
    cost: c.mana_cost || face.mana_cost || null, text: c.oracle_text || (c.card_faces || []).map(f => [f.name, f.oracle_text].filter(Boolean).join('\n')).filter(Boolean).join('\n\n') || null,
    flavor: c.flavor_text || face.flavor_text || null, artist: c.artist || null,
    img: im.large || im.normal || null, imgSm: im.small || im.normal || null,
    url: (c.purchase_uris || {}).tcgplayer || c.scryfall_uri || null, prices, sources,
  };
}

async function search(q, limit = 20) {
  try {
    const j = await getJSON(BASE() + '/cards/search?unique=prints&order=released&q=' + encodeURIComponent(q), { ttl: HOUR, limit: 4 });
    return (j.data || []).slice(0, limit).map(norm);
  } catch (e) { if (e instanceof HttpError && e.status === 404) return []; throw e; }
}

async function byTcg(id) {
  try { return norm(await getJSON(BASE() + '/cards/tcgplayer/' + encodeURIComponent(id), { ttl: 12 * HOUR })); }
  catch (e) { if (e instanceof HttpError && e.status === 404) return null; throw e; }
}

// Details for a card: by its TCGplayer id when known, else by set and number, else by exact name.
async function details(c) {
  if (c.tcg) { const x = await byTcg(c.tcg); if (x) return x; }
  const q = ['!"' + String(c.name || '').replace(/"/g, '') + '"', c.num ? 'cn:"' + c.num + '"' : ''].join(' ').trim();
  const L = await search(q, 40);
  const set = String(c.set || '').toLowerCase();
  return L.find(x => x.set.toLowerCase() === set && (!c.num || x.num === c.num)) || L.find(x => x.set.toLowerCase() === set) || L[0] || null;
}

module.exports = { search, details, byTcg, norm };
