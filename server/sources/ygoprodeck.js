// YGOPRODeck (ygoprodeck.com): free Yu-Gi-Oh! card data with rules text, every printing (set code and rarity)
// and TCGplayer, Cardmarket and eBay prices. House rule: at most 20 requests a second.
const { getJSON, HttpError } = require('../http');
const BASE = () => (process.env.YGOPRODECK_BASE || 'https://db.ygoprodeck.com').replace(/\/$/, '');
const HOUR = 36e5;
const num = v => (v == null || v === '' || !isFinite(+v) || +v <= 0 ? null : +v);

// One result per printing, newest set data first, with the card-level prices YGOPRODeck tracks.
function prints(c) {
  const pr = (c.card_prices || [])[0] || {}, img = (c.card_images || [])[0] || {};
  const sources = [];
  if (num(pr.tcgplayer_price)) sources.push({ site: 'TCGplayer', label: 'Market', price: num(pr.tcgplayer_price), cur: 'USD' });
  if (num(pr.cardmarket_price)) sources.push({ site: 'Cardmarket', label: 'Trend', price: num(pr.cardmarket_price), cur: 'EUR' });
  if (num(pr.ebay_price)) sources.push({ site: 'eBay', label: 'Listed', price: num(pr.ebay_price), cur: 'USD' });
  const type = [c.type, c.race, c.attribute].filter(Boolean).join(' · ');
  const stats = c.atk != null ? `ATK ${c.atk}${c.def != null ? ' / DEF ' + c.def : ''}${c.level ? ' · Level ' + c.level : ''}` : '';
  const base = {
    tcg: null, game: 'Yu-Gi-Oh!', origin: 'ygoprodeck', name: c.name, type, text: [c.desc, stats].filter(Boolean).join('\n'),
    artist: null, img: img.image_url || null, imgSm: img.image_url_small || null, sources,
    url: 'https://www.tcgplayer.com/search/yugioh/product?q=' + encodeURIComponent(c.name),
  };
  const sets = c.card_sets || [];
  if (!sets.length) return [{ ...base, id: 'ygo:' + c.id, set: null, setCode: null, num: null, rarity: null, prices: {} }];
  return sets.map(s => ({
    ...base, id: 'ygo:' + c.id + ':' + s.set_code + ':' + (s.set_rarity_code || ''), set: s.set_name, setCode: String(s.set_code || '').split('-')[0],
    num: s.set_code, rarity: s.set_rarity || null, prices: num(s.set_price) ? { Normal: { market: num(s.set_price) } } : {},
  }));
}

async function lookup(param, value) {
  try {
    const j = await getJSON(BASE() + '/api/v7/cardinfo.php?' + param + '=' + encodeURIComponent(value), { ttl: HOUR, limit: 4 });
    return j.data || [];
  } catch (e) { if (e instanceof HttpError && e.status === 400) return []; throw e; }
}

async function search(q, limit = 20) {
  const L = await lookup('fname', q);
  return L.slice(0, limit).flatMap(prints).slice(0, limit);
}

async function details(c) {
  const L = (await lookup('name', c.name)).flatMap(prints);
  return L.find(x => c.num && x.num === c.num) || L.find(x => (x.set || '').toLowerCase() === String(c.set || '').toLowerCase()) || L[0] || null;
}

module.exports = { search, details, prints };
