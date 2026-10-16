// PriceCharting (pricecharting.com): sold-price guides for trading cards, ungraded and by grade. Its API needs a
// PriceCharting subscription's API token: set PRICECHARTING_TOKEN on the server. Prices come back in pennies.
const { getJSON } = require('../http');
const BASE = () => (process.env.PRICECHARTING_BASE || 'https://www.pricecharting.com').replace(/\/$/, '');
const HOUR = 36e5;
const on = () => !!process.env.PRICECHARTING_TOKEN;

// PriceCharting's price fields for cards: ungraded, then grades 7, 8, 9, 9.5 and PSA 10.
const GRADE = { 7: 'cib-price', 8: 'new-price', 9: 'graded-price', 9.5: 'box-only-price', 10: 'manual-only-price' };
const fold = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

async function comp(c) {
  if (!on() || !c.name) return null;
  const n = String(c.num || '').split('/')[0].replace(/^0+(?=\d)/, '');
  const q = [c.name, n].filter(Boolean).join(' ');
  const j = await getJSON(BASE() + '/api/products?' + new URLSearchParams({ t: process.env.PRICECHARTING_TOKEN, q }), { ttl: 12 * HOUR, cacheKey: 'pc:' + q, timeout: 20000 });
  const L = j && Array.isArray(j.products) ? j.products : [];
  const name = fold(c.name), set = fold(c.set), num = n ? new RegExp('#\\s*0*' + n.replace(/[^0-9a-z]/gi, '') + '\\b', 'i') : null;
  const score = p => (fold(p['product-name']).includes(name) ? 4 : 0) + (num && num.test(p['product-name'] || '') ? 3 : 0)
    + (set && fold(p['console-name']).split(' ').filter(w => w.length > 2 && set.includes(w)).length ? 2 : 0);
  const p = L.filter(x => score(x) >= 4).sort((a, b) => score(b) - score(a))[0];
  if (!p) return null;
  const g = c.grader && c.grade ? GRADE[+c.grade] : null, field = g && p[g] ? g : 'loose-price', cents = +p[field];
  if (!(cents > 0)) return null;
  return {
    site: 'PriceCharting', label: field === 'loose-price' ? 'Ungraded sold' : 'Grade ' + c.grade + ' sold', price: cents / 100, cur: 'USD',
    url: 'https://www.pricecharting.com/search-products?' + new URLSearchParams({ q: [p['product-name'], p['console-name']].join(' '), type: 'prices' }),
  };
}

module.exports = { comp, on };
