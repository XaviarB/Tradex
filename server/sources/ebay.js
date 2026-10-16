// eBay Browse API: current Buy It Now listings for a card, for the eBay price comp. eBay has no free source of sold
// prices, so the comp is the median asking price of matching listings. Needs a free eBay developer app
// (developer.ebay.com): set EBAY_CLIENT_ID and EBAY_CLIENT_SECRET on the server. 5,000 searches a day are free.
const { getJSON, UA } = require('../http');
const API = () => (process.env.EBAY_API_BASE || 'https://api.ebay.com').replace(/\/$/, '');
const HOUR = 36e5;
const on = () => !!(process.env.EBAY_CLIENT_ID && process.env.EBAY_CLIENT_SECRET);

let token = null;
async function auth() {
  if (token && token.until > Date.now()) return token.value;
  const res = await fetch(API() + '/identity/v1/oauth2/token', {
    method: 'POST',
    headers: { 'User-Agent': UA, 'Content-Type': 'application/x-www-form-urlencoded', Authorization: 'Basic ' + Buffer.from(process.env.EBAY_CLIENT_ID + ':' + process.env.EBAY_CLIENT_SECRET).toString('base64') },
    body: 'grant_type=client_credentials&scope=' + encodeURIComponent('https://api.ebay.com/oauth/api_scope'),
    signal: AbortSignal.timeout(15000),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok || !j.access_token) throw new Error('eBay sign-in failed (' + res.status + '): ' + (j.error_description || j.error || 'check EBAY_CLIENT_ID and EBAY_CLIENT_SECRET'));
  token = { value: j.access_token, until: Date.now() + Math.max(60, (j.expires_in || 7200) - 300) * 1000 };
  return token.value;
}

const median = L => { const s = [...L].sort((a, b) => a - b), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const GRADED = /\b(PSA|BGS|CGC|SGC|Beckett|graded|slab)\b/i;
const JUNK = /\b(proxy|custom|replica|orica|digital|code card|lot of|bundle|choose|pick)\b/i;

// The eBay comp for a card {name, set, num, grader, grade}: median asking price of listings whose title has the
// card's name and number (and, for a graded card, its grader and grade; ungraded cards leave out slabs).
async function comp(c) {
  if (!on() || !c.name) return null;
  const n = String(c.num || '').split('/')[0].replace(/^0+(?=\d)/, '');
  const q = [c.name, n, c.grader, c.grader && c.grade].filter(Boolean).join(' ');
  const url = API() + '/buy/browse/v1/item_summary/search?' + new URLSearchParams({ q, limit: '100', filter: 'buyingOptions:{FIXED_PRICE},priceCurrency:USD' });
  const j = await getJSON(url, { ttl: 6 * HOUR, cacheKey: 'ebay:' + q, timeout: 20000, headers: { Authorization: 'Bearer ' + await auth(), 'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US' } });
  const words = String(c.name).toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length > 1);
  const L = (j.itemSummaries || []).filter(it => {
    const t = String(it.title || ''), tl = t.toLowerCase();
    if (!it.price || it.price.currency !== 'USD' || JUNK.test(t)) return false;
    if (!words.every(w => tl.includes(w))) return false;
    if (n && !new RegExp('(^|[^0-9])0*' + n.replace(/[^0-9a-z]/gi, '') + '([^0-9]|$)', 'i').test(t)) return false;
    return c.grader ? GRADED.test(t) && new RegExp('\\b' + String(c.grader).replace(/[^a-z0-9]/gi, '') + '\\b', 'i').test(t) && (!c.grade || new RegExp('\\b' + String(c.grade).replace('.', '\\.') + '\\b').test(t)) : !GRADED.test(t);
  }).map(it => +it.price.value).filter(v => v > 0);
  if (!L.length) return null;
  return {
    site: 'eBay', label: 'Median listed · ' + L.length, price: Math.round(median(L) * 100) / 100, cur: 'USD',
    url: 'https://www.ebay.com/sch/i.html?' + new URLSearchParams({ _nkw: q, LH_BIN: '1' }),
  };
}

module.exports = { comp, on, median };
