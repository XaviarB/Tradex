// The card games Tradéx knows, keyed by their TCGplayer category id (the ids TCGCSV uses).
// `name` is the game name the app shows and stores on cards.
const GAMES = [
  { cat: 1, key: 'magic', name: 'Magic' },
  { cat: 3, key: 'pokemon', name: 'Pokémon' },
  { cat: 2, key: 'yugioh', name: 'Yu-Gi-Oh!' },
  { cat: 68, key: 'onepiece', name: 'One Piece' },
  { cat: 71, key: 'lorcana', name: 'Lorcana' },
  { cat: 62, key: 'fab', name: 'Flesh and Blood' },
  { cat: 63, key: 'digimon', name: 'Digimon' },
  { cat: 80, key: 'dbfw', name: 'Dragon Ball Fusion World' },
  { cat: 27, key: 'dbs', name: 'Dragon Ball Super' },
  { cat: 79, key: 'swu', name: 'Star Wars Unlimited' },
  { cat: 89, key: 'riftbound', name: 'Riftbound' },
  { cat: 86, key: 'gundam', name: 'Gundam' },
  { cat: 81, key: 'unionarena', name: 'Union Arena' },
  { cat: 20, key: 'weiss', name: 'Weiss Schwarz' },
  { cat: 16, key: 'vanguard', name: 'Cardfight!! Vanguard' },
  { cat: 24, key: 'fftcg', name: 'Final Fantasy' },
  { cat: 77, key: 'sorcery', name: 'Sorcery' },
  { cat: 74, key: 'grandarchive', name: 'Grand Archive' },
  { cat: 66, key: 'metazoo', name: 'MetaZoo' },
  { cat: 85, key: 'pokemonjp', name: 'Pokémon Japan' },
];

// Games loaded into the card database each night unless TX_CATALOG_GAMES says otherwise
// (a comma list of keys or category ids, or "all" for every game above).
const DEFAULT_KEYS = ['magic', 'pokemon', 'yugioh', 'onepiece', 'lorcana', 'fab', 'digimon', 'dbfw', 'swu', 'riftbound', 'gundam'];

const fold = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
// Finds a game by key, category id or name ("pokemon", "3", "Pokémon" and "Pokemon" all work).
function gameOf(x) {
  if (x == null || x === '') return null;
  const f = fold(x);
  return GAMES.find(g => String(g.cat) === String(x) || g.key === f || fold(g.name) === f) || null;
}

function ingestGames(env = process.env.TX_CATALOG_GAMES) {
  if (env && env.trim().toLowerCase() === 'all') return GAMES;
  const keys = env ? env.split(',').map(s => s.trim()).filter(Boolean) : DEFAULT_KEYS;
  return keys.map(gameOf).filter(Boolean);
}

// TCGplayer price sub-types ("Normal", "Holofoil", "Reverse Holofoil", "Foil", "1st Edition Holofoil", ...)
// and the finish names the app uses for each game.
const FINISH = {
  'Pokémon': { Normal: 'Non-Holo', Holofoil: 'Holo', 'Reverse Holofoil': 'Reverse Holo' },
  Magic: { Normal: 'Non-Foil', Foil: 'Foil' },
  'One Piece': { Normal: 'Standard', Foil: 'Foil' },
};
function finishOf(game, sub) {
  if (!sub) return '';
  const m = FINISH[game] || {};
  if (m[sub]) return m[sub];
  const base = sub.replace(/^(1st Edition|Unlimited|Limited)\s+/, '');
  return m[base] ? (sub.startsWith('1st Edition') ? '1st Edition ' + m[base] : m[base]) : sub;
}
// The reverse: which sub-type of a product's prices matches the finish on a card.
function subFor(game, finish, subs) {
  if (!subs || !subs.length) return null;
  if (!finish) return subs.includes('Normal') ? 'Normal' : subs[0];
  const exact = subs.find(s => finishOf(game, s) === finish || s === finish);
  if (exact) return exact;
  const f = finish.toLowerCase();
  const foily = /holo|foil|etched|rainbow|gold|parallel|alt/.test(f) && !/non-?(holo|foil)/.test(f);
  if (/reverse/.test(f)) return subs.find(s => /reverse/i.test(s)) || subs[0];
  if (foily) return subs.find(s => /holo|foil/i.test(s) && !/reverse/i.test(s)) || subs[0];
  return subs.includes('Normal') ? 'Normal' : subs[0];
}

module.exports = { GAMES, gameOf, ingestGames, finishOf, subFor, fold };
