const test = require('node:test');
const assert = require('node:assert/strict');
const mock = require('./mock-upstream');

// A TCGCSV daily price archive: <day>/<category>/<group>/prices, packed the way TCGCSV packs them (7-Zip, PPMd).
async function archive(day, groups) {
  const z = await require('7z-wasm')({ print: () => {}, printErr: () => {} });
  for (const [path, results] of Object.entries(groups)) {
    z.FS.mkdirTree('/src/' + day + '/' + path);
    z.FS.writeFile('/src/' + day + '/' + path + '/prices', JSON.stringify({ success: true, errors: [], results }));
  }
  z.FS.chdir('/src');
  z.callMain(['a', '-m0=PPMd', '/out.7z', day]);
  return z.FS.readFile('/out.7z');
}

let up;
const quiet = console.log;
test.before(async () => {
  up = await mock.start();
  Object.assign(process.env, up.env, { SUPABASE_ANON_KEY: 'sb_publishable_test', SUPABASE_SERVICE_ROLE_KEY: 'sb_secret_test', TX_CATALOG_GAMES: 'pokemon' });
  console.log = () => {};
});
test.after(async () => { console.log = quiet; await up.close(); });

test('the days filled in: daily for a month, then weekly back to a year, never before the first archive', () => {
  const { backfillDays } = require('../server/backfill');
  const d = backfillDays(new Date('2026-10-16T12:00:00Z'));
  assert.equal(d[d.length - 1], '2026-10-15');
  assert.ok(d.includes('2026-09-16'));
  assert.ok(d.includes('2025-10-17'), 'a year back');
  assert.equal(d.length, 30 + 52 - 4);
  assert.deepEqual(backfillDays(new Date('2024-02-20T00:00:00Z')).slice(0, 1), ['2024-02-08']);
});

test('owned cards get their earlier prices from the TCGCSV archives, once', async () => {
  require('../server/http')._cache.clear();
  up.tables.cards.push({ id: 'a', extra: { src: { tcg: 42382, sub: 'Holofoil' } } });
  await require('../server/ingest').run({ pause: 0 });
  const p = (id, sub, market) => ({ productId: id, subTypeName: sub, marketPrice: market, lowPrice: market - 50, midPrice: market, highPrice: market * 2 });
  up.setArchive('2026-09-01', await archive('2026-09-01', { '3/604': [p(42382, 'Holofoil', 310), p(42346, 'Holofoil', 60)], '3/23237': [p(517045, 'Holofoil', 250)] }));
  up.setArchive('2026-10-01', await archive('2026-10-01', { '3/604': [p(42382, 'Holofoil', 350)] }));
  const bf = require('../server/backfill');
  const s = await bf.run({ days: ['2026-09-01', '2026-09-15', '2026-10-01'], pause: 0 });
  assert.equal(s.days, 2);
  assert.equal(s.missing, 1, 'a day without an archive is skipped');
  const h = up.tables.price_history.filter(x => x.product_id === 42382).map(x => [x.day, x.market]).sort();
  assert.deepEqual(h, [['2026-09-01', 310], ['2026-10-01', 350], ['2026-10-15', 389.99]]);
  assert.ok(!up.tables.price_history.some(x => x.product_id === 42346), 'only owned cards');
  const again = await bf.run({ days: ['2026-09-01'], pause: 0 });
  assert.equal(again.skipped, 'nothing new');
  const st = await require('../server/catalog').status();
  assert.equal(st.history.cards, 1);
});
