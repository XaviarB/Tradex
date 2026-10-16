// Test data in each source's response format. Names, sets and numbers are real cards; prices are examples.
const CDN = 'https://tcgplayer-cdn.tcgplayer.com/product/';
const ext = o => Object.entries(o).map(([name, value]) => ({ name, displayName: name, value }));
const prod = (productId, categoryId, groupId, name, x) => ({
  productId, name, cleanName: name.replace(/[^\w ]/g, ''), imageUrl: CDN + productId + '_200w.jpg', categoryId, groupId,
  url: 'https://www.tcgplayer.com/product/' + productId, modifiedOn: '2026-02-17T00:00:00', imageCount: 1,
  presaleInfo: { isPresale: false, releasedOn: null, note: null }, extendedData: x ? ext(x) : [],
});
const price = (productId, subTypeName, marketPrice, lowPrice) => ({ productId, lowPrice, midPrice: marketPrice, highPrice: marketPrice * 3, marketPrice, directLowPrice: null, subTypeName });

module.exports = {
  groups: {
    3: [{ groupId: 604, name: 'Base Set', abbreviation: 'BS', isSupplemental: false, publishedOn: '1999-01-09T00:00:00', modifiedOn: '2026-02-17T00:00:00', categoryId: 3 },
      { groupId: 23237, name: 'SV: Scarlet & Violet 151', abbreviation: 'MEW', isSupplemental: false, publishedOn: '2023-09-22T00:00:00', modifiedOn: '2026-03-01T00:00:00', categoryId: 3 }],
    1: [{ groupId: 1, name: 'Limited Edition Alpha', abbreviation: 'LEA', isSupplemental: false, publishedOn: '1993-08-05T00:00:00', modifiedOn: '2026-01-01T00:00:00', categoryId: 1 },
      { groupId: 23019, name: 'Dominaria United', abbreviation: 'DMU', isSupplemental: false, publishedOn: '2022-09-09T00:00:00', modifiedOn: '2026-01-01T00:00:00', categoryId: 1 }],
    2: [{ groupId: 2001, name: 'Legend of Blue Eyes White Dragon', abbreviation: 'LOB', isSupplemental: false, publishedOn: '2002-03-08T00:00:00', modifiedOn: '2026-01-01T00:00:00', categoryId: 2 }],
  },
  products: {
    604: [
      prod(42346, 3, 604, 'Alakazam', { Number: '001/102', Rarity: 'Holo Rare', 'Card Type': 'Psychic', HP: '80', Stage: 'Stage 2', CardText: '<strong>Pokémon Power: Damage Swap</strong><br>As often as you like during your turn, you may move 1 damage counter.', 'Attack 1': '[PPP] Confuse Ray (30)<br>Flip a coin. If heads, the Defending Pokémon is now Confused.' }),
      prod(42382, 3, 604, 'Charizard', { Number: '004/102', Rarity: 'Holo Rare', 'Card Type': 'Fire', HP: '120', Stage: 'Stage 2', 'Attack 1': '[4] Fire Spin (100)' }),
      prod(42348, 3, 604, 'Chansey', { Number: '003/102', Rarity: 'Holo Rare', 'Card Type': 'Colorless', HP: '120' }),
      prod(42400, 3, 604, 'Base Set Booster Box', null),
    ],
    23237: [
      prod(517045, 3, 23237, 'Charizard ex - 199/165', { Number: '199/165', Rarity: 'Special Illustration Rare', 'Card Type': 'Fire', HP: '330', Stage: 'Stage 2' }),
      prod(517012, 3, 23237, 'Charmander - 004/165', { Number: '004/165', Rarity: 'Common', 'Card Type': 'Fire', HP: '70' }),
    ],
    1: [prod(1001, 1, 1, 'Black Lotus', { Number: '232', Rarity: 'R', 'Card Type': 'Artifact', Artist: 'Christopher Rush' }),
      prod(1002, 1, 1, 'Llanowar Elves', { Number: '210', Rarity: 'C', 'Card Type': 'Creature — Elf Druid' })],
    23019: [prod(279860, 1, 23019, 'Llanowar Elves', { Number: '168', Rarity: 'C', 'Card Type': 'Creature — Elf Druid' })],
    2001: [prod(21001, 2, 2001, 'Blue-Eyes White Dragon', { Number: 'LOB-001', Rarity: 'Ultra Rare', 'Card Type': 'Normal Monster', Attribute: 'LIGHT' })],
  },
  prices: {
    604: [price(42346, 'Holofoil', 70.82, 43.5), price(42382, 'Holofoil', 389.99, 300), price(42348, 'Holofoil', 49.5, 35), price(42400, 'Normal', 450000, 400000)],
    23237: [price(517045, 'Holofoil', 268.4, 240), price(517012, 'Normal', 0.31, 0.1), price(517012, 'Reverse Holofoil', 1.2, 0.8)],
    1: [price(1001, 'Normal', 21500, 17000), price(1002, 'Normal', 95, 70)],
    23019: [price(279860, 'Normal', 0.39, 0.15), price(279860, 'Foil', 1.25, 0.9)],
    2001: [price(21001, 'Normal', 129.99, 95), price(21001, '1st Edition', 1450, 1200)],
  },
  scryfall: [{
    object: 'card', id: 'b0faa7f2-b547-42c4-a810-839da50dadfe', name: 'Black Lotus', set: 'lea', set_name: 'Limited Edition Alpha', collector_number: '232',
    released_at: '1993-08-05', rarity: 'rare', type_line: 'Artifact', mana_cost: '{0}', oracle_text: '{T}, Sacrifice Black Lotus: Add three mana of any one color.',
    artist: 'Christopher Rush', tcgplayer_id: 1001, image_uris: { small: 'https://cards.scryfall.io/small/lotus.jpg', normal: 'https://cards.scryfall.io/normal/lotus.jpg', large: 'https://cards.scryfall.io/large/lotus.jpg' },
    prices: { usd: '21500.00', usd_foil: null, eur: '18000.00', eur_foil: null }, purchase_uris: { tcgplayer: 'https://www.tcgplayer.com/product/1001' }, scryfall_uri: 'https://scryfall.com/card/lea/232',
  }, {
    object: 'card', id: '8bbcfb77-daa1-4ce5-b5f9-48d0a8edbba9', name: 'Llanowar Elves', set: 'dmu', set_name: 'Dominaria United', collector_number: '168',
    released_at: '2022-09-09', rarity: 'common', type_line: 'Creature — Elf Druid', mana_cost: '{G}', oracle_text: '{T}: Add {G}.', flavor_text: 'The elves of the Llanowar forest have defended it for generations.',
    artist: 'Chris Rahn', tcgplayer_id: 279860, image_uris: { small: 'https://cards.scryfall.io/small/elves.jpg', large: 'https://cards.scryfall.io/large/elves.jpg' },
    prices: { usd: '0.39', usd_foil: '1.25', eur: '0.20' },
  }],
  pokemontcg: [{
    id: 'base1-4', name: 'Charizard', supertype: 'Pokémon', subtypes: ['Stage 2'], hp: '120', types: ['Fire'], number: '4', artist: 'Mitsuhiro Arita', rarity: 'Rare Holo',
    abilities: [{ name: 'Energy Burn', text: 'As often as you like during your turn, you may turn all Energy attached to Charizard into Fire Energy.', type: 'Pokémon Power' }],
    attacks: [{ name: 'Fire Spin', cost: ['Fire', 'Fire', 'Fire', 'Fire'], damage: '100', text: 'Discard 2 Energy cards attached to Charizard.' }],
    flavorText: 'Spits fire that is hot enough to melt boulders.',
    set: { id: 'base1', name: 'Base', series: 'Base', printedTotal: 102, releaseDate: '1999/01/09', ptcgoCode: 'BS' },
    images: { small: 'https://images.pokemontcg.io/base1/4.png', large: 'https://images.pokemontcg.io/base1/4_hires.png' },
    tcgplayer: { url: 'https://prices.pokemontcg.io/tcgplayer/base1-4', prices: { holofoil: { low: 300, mid: 420, high: 1500, market: 389.99 } } },
    cardmarket: { url: 'https://prices.pokemontcg.io/cardmarket/base1-4', prices: { averageSellPrice: 330, trendPrice: 345.5 } },
  }],
  ygo: [{
    id: 89631139, name: 'Blue-Eyes White Dragon', type: 'Normal Monster', desc: 'This legendary dragon is a powerful engine of destruction.', atk: 3000, def: 2500, level: 8, race: 'Dragon', attribute: 'LIGHT',
    card_sets: [{ set_name: 'Legend of Blue Eyes White Dragon', set_code: 'LOB-001', set_rarity: 'Ultra Rare', set_rarity_code: '(UR)', set_price: '129.99' }],
    card_images: [{ id: 89631139, image_url: 'https://images.ygoprodeck.com/images/cards/89631139.jpg', image_url_small: 'https://images.ygoprodeck.com/images/cards_small/89631139.jpg' }],
    card_prices: [{ cardmarket_price: '0.27', tcgplayer_price: '0.31', ebay_price: '2.99', amazon_price: '1.00', coolstuffinc_price: '0.99' }],
  }],
};
