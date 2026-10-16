// TCGCSV (tcgcsv.com): a free daily copy of TCGplayer's catalog and prices for every game TCGplayer sells.
// It is the only open source of TCGplayer market prices (TCGplayer's own API takes no new developers).
// House rules: refresh at most once a day, set a User-Agent, sleep ~100 ms between calls, stay under 10,000 calls a day.
const { getJSON } = require('../http');
const { gameOf } = require('../games');

const BASE = () => (process.env.TCGCSV_BASE || 'https://tcgcsv.com').replace(/\/$/, '');
const DAY = 864e5;
const results = j => (j && Array.isArray(j.results) ? j.results : []);

const lastUpdated = () => fetch(BASE() + '/last-updated.txt', { headers: { 'User-Agent': require('../http').UA }, signal: AbortSignal.timeout(15000) })
  .then(r => (r.ok ? r.text() : Promise.reject(new Error('HTTP ' + r.status)))).then(t => t.trim());
const groups = cat => getJSON(`${BASE()}/tcgplayer/${cat}/groups`, { limit: 2 }).then(results);
// Products are cached for a day so card detail lookups don't refetch a set.
const products = (cat, group, ttl = DAY) => getJSON(`${BASE()}/tcgplayer/${cat}/${group}/products`, { limit: 2, ttl }).then(results);
const prices = (cat, group) => getJSON(`${BASE()}/tcgplayer/${cat}/${group}/prices`, { limit: 2 }).then(results);

// TCGplayer image links end in _200w.jpg; the same picture is available larger.
const image = (url, size = 'in_1000x1000') => (url ? url.replace(/_\d+w(\.\w+)$/, '_' + size + '$1') : null);

const ext = p => {
  const o = {};
  for (const e of p.extendedData || []) if (e && e.name) o[e.name] = e.value;
  return o;
};
// A product is a single card when TCGplayer lists a collector number or rarity for it (sealed product has neither).
const isCard = p => { const x = ext(p); return !!(x.Number || x.Rarity); };

const stripHtml = s => (s == null ? null : String(s).replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim());

// TCGplayer names newer Pokémon cards "Charizard ex - 199/165"; the number already has its own column.
const shortName = (name, number) => (number && name.endsWith(' - ' + number) ? name.slice(0, -(number.length + 3)) : name);

// One catalog_cards row from a TCGCSV product and its set.
function cardRow(p, group, game) {
  const x = ext(p);
  const type = x['Card Type'] || x.CardType || x.Type || x['Monster Type'] || x.SubType || null;
  return {
    product_id: p.productId,
    category_id: p.categoryId,
    group_id: p.groupId,
    game: game.name,
    name: shortName(p.name, x.Number),
    clean_name: p.cleanName || p.name,
    set_name: group ? group.name : null,
    set_code: group ? group.abbreviation || null : null,
    released: group && group.publishedOn ? group.publishedOn.slice(0, 10) : null,
    number: x.Number || null,
    rarity: x.Rarity || null,
    card_type: type,
    image_url: p.imageUrl || null,
    url: p.url || null,
    modified_on: p.modifiedOn || null,
  };
}

// Pokémon energy letters TCGplayer uses in attack costs, e.g. "[RCC] Fire Spin (100)".
const ENERGY = { G: 'Grass', R: 'Fire', W: 'Water', L: 'Lightning', P: 'Psychic', F: 'Fighting', D: 'Darkness', M: 'Metal', Y: 'Fairy', N: 'Dragon', C: 'Colorless' };
const energyOf = cost => {
  const out = [];
  for (const t of String(cost).match(/\d+|[A-Za-z]+/g) || []) {
    if (/^\d+$/.test(t)) { for (let i = 0; i < Math.min(+t, 8); i++) out.push('Colorless'); continue; }
    const w = Object.values(ENERGY).find(e => e.toLowerCase() === t.toLowerCase());
    if (w) out.push(w); else for (const ch of t.toUpperCase()) if (ENERGY[ch]) out.push(ENERGY[ch]);
  }
  return out;
};
// One attack from TCGplayer's "Attack 1" field: "[cost] Name (damage)" then the effect on the next line.
function attackOf(raw) {
  const t = stripHtml(raw);
  if (!t) return null;
  const nl = t.indexOf('\n'), head = (nl < 0 ? t : t.slice(0, nl)).trim(), text = nl < 0 ? '' : t.slice(nl + 1).trim();
  const m = /^(?:\[([^\]]*)\]\s*)?(.+?)(?:\s*\(([^)]*)\))?$/.exec(head);
  if (!m) return { kind: 'attack', name: head, cost: [], text, damage: '' };
  return { kind: 'attack', name: m[2].trim(), cost: m[1] ? energyOf(m[1]) : [], text, damage: (m[3] || '').trim() };
}
// Abilities in TCGplayer's card text start with a bold heading ("Ability: Name", "Poké-POWER — Name", ...).
const POWER = /^(Ability|Pok[eé]-?Power|Pok[eé]-?Body|Pok[eé]mon Power|Ancient Trait|VSTAR Power|Held Item)\s*[:—–-]?\s*(.*)$/i;
function powersOf(html) {
  if (!html) return { moves: [], rest: null };
  const parts = String(html).split(/<(?:strong|b)>(.*?)<\/(?:strong|b)>/i), moves = [], rest = [];
  if (parts[0] && stripHtml(parts[0])) rest.push(stripHtml(parts[0]));
  for (let i = 1; i < parts.length; i += 2) {
    const h = stripHtml(parts[i]) || '', body = stripHtml(parts[i + 1] || '') || '', m = POWER.exec(h);
    if (m && m[2]) moves.push({ kind: 'power', label: m[1], name: m[2].trim(), text: body });
    else rest.push([h, body].filter(Boolean).join('\n'));
  }
  return { moves, rest: rest.join('\n').trim() || null };
}

// Rules text and stats for the card detail view, from a product's extendedData.
// Pokémon cards also get their abilities and attacks as moves (the app's format, see js/card-symbols.js).
function detailsOf(p) {
  const x = ext(p), atk = Object.keys(x).filter(k => /^Attack \d/.test(k)).sort((a, b) => parseInt(a.slice(7), 10) - parseInt(b.slice(7), 10));
  const raw = x.CardText || x.Description || x['Card Text'] || null;
  const pw = atk.length || POWER.test(stripHtml((/<(?:strong|b)>(.*?)<\/(?:strong|b)>/i.exec(raw || '') || [])[1] || '') || '') ? powersOf(raw) : null;
  const moves = pw ? [...pw.moves, ...atk.map(k => attackOf(x[k])).filter(Boolean)] : [];
  return {
    text: pw ? pw.rest : stripHtml(raw),
    moves: moves.length ? moves : null,
    flavor: stripHtml(x.FlavorText || x['Flavor Text'] || null),
    hp: x.HP || null, stage: x.Stage || null,
    weakness: x.Weakness || null, resistance: x.Resistance || null, retreat: x.RetreatCost || null,
    cost: x.Cost || x['Mana Cost'] || x.ManaCost || null, attribute: x.Attribute || x.Color || null,
    artist: x.Artist || x.Illustrator || null,
  };
}

// catalog_prices rows (one per product and price sub-type) for the given day.
const priceRows = (list, keep, day) => list.filter(r => r && keep.has(r.productId) && r.subTypeName).map(r => ({
  product_id: r.productId, sub: r.subTypeName, day,
  market: r.marketPrice, low: r.lowPrice, mid: r.midPrice, high: r.highPrice, direct_low: r.directLowPrice,
}));

module.exports = { attackOf, powersOf, BASE, lastUpdated, groups, products, prices, image, ext, isCard, cardRow, detailsOf, priceRows, gameOf };
