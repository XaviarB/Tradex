const test = require('node:test');
const assert = require('node:assert/strict');
const mock = require('./mock-upstream');

let up;
const quiet = console.log;
test.before(async () => {
  up = await mock.start();
  Object.assign(process.env, up.env, { SUPABASE_ANON_KEY: 'sb_publishable_test', SUPABASE_SERVICE_ROLE_KEY: 'sb_secret_test', TX_CATALOG_GAMES: 'pokemon' });
  console.log = () => {};
  await require('../server/ingest').run({ pause: 0, always: true });
});
test.after(async () => { console.log = quiet; await up.close(); });
const fresh = () => require('../server/http')._cache.clear();
const enrich = card => require('../server/catalog').enrich([card], { withDetails: true }).then(r => r[0]);
const box = (c, site) => c.sources.find(s => s.site === site);

test('no eBay or PriceCharting box without their keys', async () => {
  fresh();
  delete process.env.EBAY_CLIENT_ID; delete process.env.PRICECHARTING_TOKEN;
  const c = await enrich({ game: 'Pokémon', name: 'Charizard', tcg: 42382, sub: 'Holofoil' });
  assert.equal(box(c, 'eBay'), undefined);
  assert.equal(box(c, 'PriceCharting'), undefined);
  assert.deepEqual(require('../server/catalog').status && (await require('../server/catalog').status()).comps, { ebay: false, pricecharting: false });
});

test('eBay: median of matching raw listings; PriceCharting: ungraded sold price', async () => {
  fresh();
  Object.assign(process.env, { EBAY_CLIENT_ID: 'ebay-id', EBAY_CLIENT_SECRET: 'ebay-secret', PRICECHARTING_TOKEN: 'pc-token' });
  const c = await enrich({ game: 'Pokémon', name: 'Charizard', tcg: 42382, sub: 'Holofoil' });
  // 420, 460, 400 match; the slabs, the proxy and Charizard ex are left out.
  assert.deepEqual(box(c, 'eBay'), { site: 'eBay', label: 'Median listed · 3', price: 420, cur: 'USD', url: 'https://www.ebay.com/sch/i.html?_nkw=Charizard+4&LH_BIN=1' });
  assert.equal(box(c, 'PriceCharting').price, 415);
  assert.equal(box(c, 'PriceCharting').label, 'Ungraded sold');
});

test('graded cards get comps for their grade', async () => {
  fresh();
  const c = await enrich({ game: 'Pokémon', name: 'Charizard', tcg: 42382, sub: 'Holofoil', grader: 'PSA', grade: '10' });
  assert.equal(box(c, 'eBay').price, 12500);
  assert.equal(box(c, 'PriceCharting').price, 12500);
  assert.equal(box(c, 'PriceCharting').label, 'Grade 10 sold');
});

test('a source that fails leaves the other comps in place', async () => {
  fresh();
  process.env.PRICECHARTING_TOKEN = 'wrong';
  const c = await enrich({ game: 'Pokémon', name: 'Charizard', tcg: 42382, sub: 'Holofoil', grader: 'PSA', grade: '9' });
  assert.equal(box(c, 'PriceCharting'), undefined);
  assert.equal(box(c, 'eBay').price, 3200);
  assert.ok(box(c, 'TCGplayer'));
});
