// Nightly card database load: copies TCGplayer's card list and today's prices from TCGCSV into Supabase
// (catalog_sets, catalog_cards, catalog_prices) and adds a day to price_history for the cards people own.
// Runs inside the server once a day (see schedule()), or by hand: `npm run ingest` (add --force to reload every set).
const db = require('./supabase');
const tcgcsv = require('./sources/tcgcsv');
const { ingestGames } = require('./games');
const { sleep } = require('./http');

const CHUNK = 500;
const log = (...a) => console.log('[catalog]', ...a);

async function upsertAll(table, rows, onConflict) {
  for (let i = 0; i < rows.length; i += CHUNK) await db.upsert(table, rows.slice(i, i + CHUNK), onConflict);
}

async function getMeta(key) {
  const r = await db.select('catalog_meta', 'select=value&key=eq.' + encodeURIComponent(key));
  return r && r[0] ? r[0].value : null;
}
const setMeta = (key, value) => db.upsert('catalog_meta', [{ key, value, updated_at: new Date().toISOString() }], 'key');

// Every row of a table, page by page (PostgREST returns at most 1,000 rows per request).
async function selectAll(table, query) {
  const out = [];
  for (let from = 0; ; from += 1000) {
    const page = await db.select(table, query + '&limit=1000&offset=' + from + '&order=' + (query.match(/select=(\w+)/) || [, 'product_id'])[1]);
    out.push(...page);
    if (page.length < 1000) return out;
  }
}

async function trackedIds() {
  if (process.env.TX_HISTORY === 'all') return null; // null = keep history for every card
  const rows = await selectAll('tracked_products', 'select=product_id');
  return new Set(rows.map(r => +r.product_id));
}

// Loads one game. Sets whose card list hasn't changed since the last run only get their prices refreshed.
async function ingestGame(game, { force, day, tracked, pause, stats }) {
  const groups = await tcgcsv.groups(game.cat);
  const known = new Map((await selectAll('catalog_sets', 'select=group_id,modified_on&category_id=eq.' + game.cat))
    .map(r => [r.group_id, r.modified_on && new Date(r.modified_on).getTime()]));
  for (const g of groups) {
    try {
      const list = await tcgcsv.products(game.cat, g.groupId, 0);
      await sleep(pause);
      const cards = list.filter(tcgcsv.isCard);
      const changed = force || known.get(g.groupId) !== (g.modifiedOn ? new Date(g.modifiedOn).getTime() : null);
      const saveCards = () => upsertAll('catalog_cards', cards.map(p => ({ ...tcgcsv.cardRow(p, g, game), updated_at: new Date().toISOString() })), 'product_id');
      if (changed) {
        await saveCards();
        await db.upsert('catalog_sets', [{
          group_id: g.groupId, category_id: game.cat, game: game.name, name: g.name, abbreviation: g.abbreviation || null,
          released: g.publishedOn ? g.publishedOn.slice(0, 10) : null, modified_on: g.modifiedOn || null,
          card_count: cards.length, updated_at: new Date().toISOString(),
        }], 'group_id');
        stats.sets++; stats.cards += cards.length;
      }
      if (!cards.length) continue;
      const rows = tcgcsv.priceRows(await tcgcsv.prices(game.cat, g.groupId), new Set(cards.map(p => p.productId)), day);
      await sleep(pause);
      // A card added to a set without the set's date changing has no catalog row yet: save the set's cards, then retry.
      await upsertAll('catalog_prices', rows, 'product_id,sub').catch(async e => {
        if (changed || !/23503|foreign key/i.test(e.body || e.message)) throw e;
        await saveCards();
        await upsertAll('catalog_prices', rows, 'product_id,sub');
      });
      const hist = rows.filter(r => r.market != null && (!tracked || tracked.has(r.product_id)))
        .map(({ product_id, sub, day: d, market, low, mid, high }) => ({ product_id, sub, day: d, market, low, mid, high }));
      await upsertAll('price_history', hist, 'product_id,sub,day');
      stats.prices += rows.length; stats.history += hist.length;
    } catch (e) {
      stats.errors.push(game.name + ' / ' + g.name + ': ' + e.message);
      log('skipped set', game.name, g.name, e.message);
    }
  }
}

let running = null;
// Returns a summary; refuses to start a second run while one is going.
function run(opt = {}) {
  if (running) return running;
  running = (async () => {
    if (!db.writable()) throw new Error('Set SUPABASE_SERVICE_ROLE_KEY on the server to fill the card database.');
    const started = Date.now();
    const build = await tcgcsv.lastUpdated().catch(() => null);
    const prev = await getMeta('last_run');
    if (!opt.force && !opt.always && prev && build && prev.build === build) {
      log('TCGCSV has not changed since', build);
      return { skipped: true, build };
    }
    const day = (build && !isNaN(new Date(build)) ? new Date(build) : new Date()).toISOString().slice(0, 10);
    const games = opt.games || ingestGames();
    const stats = { sets: 0, cards: 0, prices: 0, history: 0, errors: [] };
    const tracked = await trackedIds();
    log('loading', games.map(g => g.name).join(', '), 'for', day);
    for (const game of games) {
      try { await ingestGame(game, { force: opt.force, day, tracked, pause: opt.pause ?? 100, stats }); }
      catch (e) { stats.errors.push(game.name + ': ' + e.message); log('skipped game', game.name, e.message); }
    }
    const summary = { build, day, games: games.map(g => g.name), ...stats, errors: stats.errors.slice(0, 50), seconds: Math.round((Date.now() - started) / 1000) };
    await setMeta('last_run', summary);
    log('done', JSON.stringify({ ...summary, errors: stats.errors.length }));
    return summary;
  })().finally(() => { running = null; });
  return running;
}

// Checks every hour; loads once TCGCSV has published a new daily build (it updates around 20:00 UTC).
function schedule() {
  if (!db.writable() || process.env.TX_CATALOG_SCHEDULE === 'off') return null;
  // After the nightly load, cards someone started owning get their earlier price history (see backfill.js).
  const tick = () => run().catch(e => log('run failed:', e.message)).then(() => require('./backfill').run());
  const t = setInterval(tick, 36e5);
  t.unref();
  setTimeout(tick, 60e3).unref();
  return t;
}

module.exports = { run, schedule, ingestGame, selectAll, getMeta, setMeta, trackedIds };

if (require.main === module) {
  run({ force: process.argv.includes('--force'), always: true }).then(s => { console.log(JSON.stringify(s, null, 2)); process.exit(0); })
    .catch(e => { console.error(e.message); process.exit(1); });
}
