const test = require('node:test');
const assert = require('node:assert/strict');
const mock = require('./mock-upstream');

let up;
const fresh = () => require('../server/http')._cache.clear();
const quiet = console.log;

test.before(async () => {
  up = await mock.start();
  Object.assign(process.env, up.env, { SUPABASE_ANON_KEY: 'sb_publishable_test', SUPABASE_SERVICE_ROLE_KEY: 'sb_secret_test', TX_CATALOG_GAMES: 'pokemon,magic,yugioh' });
  console.log = () => {};
});
test.after(async () => { console.log = quiet; await up.close(); });

const ingest = () => require('../server/ingest');
const catalog = () => require('../server/catalog');

test('nightly load stores single cards and prices, not sealed product', async () => {
  fresh();
  up.tables.cards.push({ id: 'a', extra: { src: { tcg: 42382, sub: 'Holofoil' } } });
  const s = await ingest().run({ pause: 0 });
  assert.equal(s.errors.length, 0, s.errors.join('\n'));
  const ids = up.tables.catalog_cards.map(r => r.product_id);
  assert.ok(ids.includes(42382));
  assert.ok(!ids.includes(42400), 'booster box should be left out');
  const zard = up.tables.catalog_cards.find(r => r.product_id === 42382);
  assert.equal(zard.game, 'Pokémon');
  assert.equal(zard.set_name, 'Base Set');
  assert.equal(zard.number, '004/102');
  assert.equal(zard.released, '1999-01-09');
  assert.equal(up.tables.catalog_prices.find(p => p.product_id === 42382).market, 389.99);
  assert.ok(!up.tables.catalog_prices.some(p => p.product_id === 42400));
  // History is kept only for cards someone owns.
  assert.deepEqual([...new Set(up.tables.price_history.map(h => h.product_id))], [42382]);
  assert.equal(up.tables.price_history[0].day, '2026-10-15');
});

test('the same TCGCSV build is not loaded twice', async () => {
  fresh();
  const s = await ingest().run({ pause: 0 });
  assert.equal(s.skipped, true);
});

test('next day: unchanged sets only refresh prices, and history grows', async () => {
  fresh();
  up.setBuild('2026-10-16T20:05:00+0000');
  up.setPriceFactor(1.1);
  const before = up.calls.length;
  const s = await ingest().run({ pause: 0 });
  assert.equal(s.sets, 0, 'no set changed');
  assert.ok(s.prices > 0);
  assert.ok(!up.calls.slice(before).some(c => c.startsWith('POST catalog_cards')), 'cards are not rewritten');
  const h = up.tables.price_history.filter(x => x.product_id === 42382).map(x => [x.day, x.market]);
  assert.deepEqual(h, [['2026-10-15', 389.99], ['2026-10-16', 428.99]]);
  up.setPriceFactor(1);
});

test('a card added to a set without the set changing is saved before its price', async () => {
  fresh();
  const F = require('./fixtures');
  F.products[604].push({ ...F.products[604][0], productId: 42999, name: 'Mew', extendedData: [{ name: 'Number', value: '151/102' }] });
  F.prices[604].push({ productId: 42999, subTypeName: 'Normal', marketPrice: 5, lowPrice: 4 });
  up.setBuild('2026-10-17T20:05:00+0000');
  const s = await ingest().run({ pause: 0 });
  assert.equal(s.errors.length, 0, s.errors.join('\n'));
  assert.ok(up.tables.catalog_cards.some(r => r.product_id === 42999));
  F.products[604].pop(); F.prices[604].pop();
});

test('search finds cards by name, set and number across games', async () => {
  fresh();
  let r = await catalog().search({ q: 'charizard' });
  assert.equal(r.from, 'catalog');
  assert.deepEqual(r.cards.map(c => c.name).sort(), ['Charizard', 'Charizard ex'], 'the number is dropped from the name');
  r = await catalog().search({ q: 'charizard base 004' });
  assert.equal(r.cards.length, 1);
  const c = r.cards[0];
  assert.equal(c.tcg, 42382);
  assert.equal(c.sub, 'Holofoil');
  assert.equal(c.price, 389.99, 'the latest day’s price');
  assert.equal(c.img, 'https://tcgplayer-cdn.tcgplayer.com/product/42382_in_1000x1000.jpg');
  r = await catalog().search({ q: 'llanowar', game: 'magic' });
  assert.deepEqual(r.cards.map(c => c.set), ['Dominaria United', 'Limited Edition Alpha']);
  assert.equal(r.cards[0].sub, 'Normal');
});

test('search falls back to Scryfall, the Pokémon TCG API and YGOPRODeck when the database has no match', async () => {
  fresh();
  let r = await catalog().search({ q: 'blue-eyes white', game: 'Yu-Gi-Oh!' });
  assert.equal(r.from, 'catalog');
  up.tables.catalog_cards.splice(0); // empty database
  fresh();
  r = await catalog().search({ q: 'charizard', game: 'Pokémon' });
  assert.equal(r.from, 'live');
  assert.equal(r.cards[0].origin, 'pokemontcg');
  assert.equal(r.cards[0].num, '4/102');
  assert.equal(r.cards[0].price, 389.99);
  assert.equal(r.cards[0].moves[1].name, 'Fire Spin');
  r = await catalog().search({ q: 'black lotus' });
  assert.ok(r.cards.some(c => c.origin === 'scryfall' && c.tcg === 1001 && c.sources.some(s => s.site === 'Cardmarket' && s.cur === 'EUR')));
  r = await catalog().search({ q: 'blue-eyes', game: 'yugioh' });
  assert.equal(r.cards[0].num, 'LOB-001');
  assert.equal(r.cards[0].price, 129.99);
});

test('enrich links typed-in cards to the right printing and adds details', async () => {
  fresh();
  await ingest().run({ pause: 0, force: true, always: true });
  fresh();
  const [a, b, none] = await catalog().enrich([
    { game: 'Pokémon', name: 'Charizard', set: 'Base Set', num: '4/102', finish: 'Holo' },
    { game: 'Magic', name: 'Llanowar Elves', set: 'Dominaria United', num: '168', finish: 'Foil' },
    { game: 'Magic', name: 'Not A Real Card' },
  ], { withDetails: true });
  assert.equal(a.tcg, 42382);
  assert.equal(a.sub, 'Holofoil');
  assert.equal(a.text, undefined, 'Base Set Charizard text comes from the Pokémon TCG API moves');
  assert.equal(a.moves[0].name, 'Energy Burn');
  assert.equal(a.artist, 'Mitsuhiro Arita');
  assert.ok(a.sources.some(s => s.site === 'Cardmarket'));
  assert.equal(b.tcg, 279860);
  assert.equal(b.sub, 'Foil');
  assert.equal(b.price, 1.25);
  assert.equal(b.artist, 'Chris Rahn');
  assert.equal(none, null);
});

test('latest prices and history for many cards at once', async () => {
  fresh();
  const items = [{ tcg: 42382, sub: 'Holofoil' }, { tcg: 279860, sub: 'Etched Foil' }, { tcg: 'x' }];
  const p = await catalog().latest(items);
  assert.equal(p['42382|Holofoil'].market, 389.99);
  assert.equal(p['279860|Etched Foil'].sub, 'Normal', 'missing finish falls back to the main price');
  const h = await catalog().history([{ tcg: 42382, sub: 'Holofoil' }], 3650);
  assert.deepEqual(h['42382|Holofoil'].d.slice(0, 2), ['2026-10-15', '2026-10-16']);
});

test('the server answers the page’s /api calls', async () => {
  fresh();
  const http = require('http');
  const api = require('../server/api');
  const srv = http.createServer((q, s) => api.handle(q, s));
  await new Promise(r => srv.listen(0, '127.0.0.1', r));
  const base = 'http://127.0.0.1:' + srv.address().port;
  try {
    const s = await fetch(base + '/api/search?q=charizard&game=pokemon').then(r => r.json());
    assert.ok(s.cards.length >= 1);
    const e = await fetch(base + '/api/enrich', { method: 'POST', body: JSON.stringify({ cards: [{ game: 'Pokémon', name: 'Alakazam', num: '1/102' }] }) }).then(r => r.json());
    assert.equal(e.cards[0].tcg, 42346);
    const pr = await fetch(base + '/api/prints?game=Magic&name=Llanowar%20Elves').then(r => r.json());
    assert.deepEqual(pr.map(x => x.set), ['Dominaria United', 'Limited Edition Alpha']);
    assert.equal((await fetch(base + '/api/catalog/ingest', { method: 'POST' })).status, 403);
    assert.equal((await fetch(base + '/api/nope')).status, 404);
    assert.equal((await fetch(base + '/api/enrich', { method: 'POST', body: '{bad' })).status, 400);
  } finally { srv.close(); }
});
