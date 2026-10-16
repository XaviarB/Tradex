// Price history from before Tradéx started tracking a card. TCGCSV keeps a daily archive of every TCGplayer price
// since 2024-02-08 (tcgcsv.com/archive/tcgplayer/prices-YYYY-MM-DD.ppmd.7z, 7-Zip files holding
// <day>/<category>/<group>/prices). For owned cards not filled in yet, this adds a price for each of the last 30 days
// and one a week back to a year, so charts show how a card's price has moved, not just the days since it was added.
const db = require('./supabase');
const tcgcsv = require('./sources/tcgcsv');
const { UA, sleep } = require('./http');
const { selectAll, getMeta, setMeta, trackedIds } = require('./ingest');

const FIRST = '2024-02-08';
const log = (...a) => console.log('[history]', ...a);
const dayStr = d => d.toISOString().slice(0, 10);

// The days to fill in: daily for the last month, then weekly back to a year (oldest archive first).
function backfillDays(today = new Date(), daily = 30, weeks = 52) {
  const out = new Set();
  for (let i = 1; i <= daily; i++) out.add(dayStr(new Date(today - i * 864e5)));
  for (let w = Math.ceil(daily / 7); w <= weeks; w++) out.add(dayStr(new Date(today - w * 7 * 864e5)));
  return [...out].filter(d => d >= FIRST).sort();
}

async function download(day) {
  const url = tcgcsv.BASE() + '/archive/tcgplayer/prices-' + day + '.ppmd.7z';
  const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(180000) });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error('HTTP ' + res.status + ' for ' + day);
  return new Uint8Array(await res.arrayBuffer());
}

// Reads the price lists of the given "category/group" pairs out of one day's archive: { "3/604": [...] }.
async function readArchive(bytes, groups) {
  const z = await require('7z-wasm')({ print: () => {}, printErr: () => {} });
  z.FS.writeFile('/a.7z', bytes);
  z.FS.mkdir('/x');
  z.FS.chdir('/x');
  z.callMain(['x', '/a.7z', '-y', '-r', ...groups.flatMap(g => [g + '/prices', '*/' + g + '/prices'])]);
  const out = {};
  const walk = d => {
    for (const n of z.FS.readdir(d)) {
      if (n === '.' || n === '..') continue;
      const p = d + '/' + n;
      if (z.FS.isDir(z.FS.stat(p).mode)) walk(p);
      else {
        const m = /(\d+)\/(\d+)\/prices$/.exec(p);
        if (m) try { out[m[1] + '/' + m[2]] = JSON.parse(z.FS.readFile(p, { encoding: 'utf8' })).results || []; } catch (e) { /* skip a bad file */ }
      }
    }
  };
  walk('/x');
  return out;
}

let running = null;
function run(opt = {}) {
  if (running) return running;
  running = (async () => {
    if (!db.writable()) return { skipped: 'no secret key' };
    const tracked = await trackedIds() || new Set((await selectAll('tracked_products', 'select=product_id')).map(r => +r.product_id));
    const meta = (await getMeta('backfill')) || { ids: [] };
    const done = new Set(meta.ids || []);
    const need = [...tracked].filter(id => !done.has(id));
    if (!need.length) return { skipped: 'nothing new' };
    const where = new Map();
    for (let i = 0; i < need.length; i += 150) {
      const rows = await db.select('catalog_cards', 'select=product_id,category_id,group_id&product_id=in.(' + need.slice(i, i + 150).join(',') + ')');
      for (const r of rows) where.set(+r.product_id, r.category_id + '/' + r.group_id);
    }
    const groups = [...new Set(where.values())], want = new Set(where.keys());
    if (!groups.length) return { skipped: 'cards not in the catalog yet' };
    const stats = { cards: want.size, days: 0, rows: 0, missing: 0 };
    log('filling in history for', want.size, 'cards');
    let misses = 0;
    for (const day of opt.days || backfillDays()) {
      try {
        const bytes = await download(day);
        if (!bytes) { stats.missing++; if (++misses >= 5 && !stats.days) throw new Error('no TCGCSV archives found'); continue; }
        const lists = await readArchive(bytes, groups);
        const rows = Object.values(lists).flat().filter(r => r && want.has(r.productId) && r.subTypeName && r.marketPrice != null)
          .map(r => ({ product_id: r.productId, sub: r.subTypeName, day, market: r.marketPrice, low: r.lowPrice, mid: r.midPrice, high: r.highPrice }));
        for (let i = 0; i < rows.length; i += 500) await db.upsert('price_history', rows.slice(i, i + 500), 'product_id,sub,day');
        stats.days++; stats.rows += rows.length;
      } catch (e) {
        if (/no TCGCSV archives/.test(e.message)) throw e;
        stats.missing++;
        log('skipped', day, e.message);
      }
      await sleep(opt.pause ?? 1000);
    }
    await setMeta('backfill', { ids: [...done, ...want], at: new Date().toISOString(), last: stats });
    log('done', JSON.stringify(stats));
    return stats;
  })().catch(e => { log('failed:', e.message); return { error: e.message }; }).finally(() => { running = null; });
  return running;
}

module.exports = { run, backfillDays, readArchive };
