# Tradéx

A card collection tracker for trading card collectors. The page keeps a copy of the collection in `localStorage`; with accounts on (see `supabase/README.md`) it syncs to Supabase.

On the Tradéx server (`npm start`) the page also gets a card database covering every game TCGplayer sells, an "Add cards" search bar, daily market prices and price history charts. See **Card database and market prices** below.

## Run it

```
npm start            # http://localhost:3000
npm run bundle       # writes dist/tradex.html, a single self-contained page
npm test             # server tests (card sources and Supabase are stood in for locally)
npm run ingest       # load the card database now (add -- --force to reload every set)
```

`index.html` also works opened straight from disk.

## Layout

The page is plain HTML, CSS and classic `<script>` files (no build step). The scripts share one global scope and must load in the order `index.html` lists them.

| File | What it holds |
| --- | --- |
| `js/core.js` | Shared helpers and constants (games, rarities, conditions, finishes, formatting) |
| `js/demo-cards.js` | Demo cards seeded into a new collection |
| `js/storage.js` | Collection state `S`: load, migrate, save, regroup binders |
| `js/collection.js` | Dashboard, collection grid, binders, filter panel, cover images |
| `js/card-edit.js` | Add/edit card form and card database lookup |
| `js/price-chart.js` | Price history chart |
| `js/card-symbols.js` | Mana/energy/attribute icons and rules text |
| `js/card-detail.js` | Card detail view, markets and versions |
| `js/market.js` | Live market data: links cards to TCGplayer printings, daily prices, price history, collection value chart |
| `js/card-search.js` | "Add cards" search bar (card database search, add to collection or binder) |
| `js/main.js` | Sidebar, navigation and filter wiring; first render |
| `js/import.js` | CSV import |
| `js/customizer.js` | Customize (theme) panel |
| `js/ios-preview.js` | iOS device preview |
| `js/nav-wheel.js` | Sidebar scroll wheel |
| `js/owner-gate.js` | Owner password gate (only on a Tradéx server) |
| `css/*.css` | Styles for the app and each panel |
| `server/backfill.js` | Earlier price history for newly owned cards, from TCGCSV's daily archives |
| `server/api.js` | The page's `/api/*` endpoints: search, prints, enrich, prices, history |
| `server/catalog.js` | Card lookups: Supabase card database first, live game databases as fallback |
| `server/ingest.js` | Nightly card database and price load from TCGCSV |
| `server/sources/*.js` | TCGCSV, Scryfall, Pokémon TCG API and YGOPRODeck clients |
| `supabase/catalog.sql` | Card database tables, search and price history functions |

## Card database and market prices

| Source | What it gives | Why |
| --- | --- | --- |
| [TCGCSV](https://tcgcsv.com) | Every card and today's TCGplayer market, low, mid and high price for every TCGplayer game (Magic, Pokémon, Yu-Gi-Oh!, One Piece, Lorcana, Flesh and Blood, Digimon, Dragon Ball, Star Wars Unlimited, Riftbound, Gundam and more) | A free daily copy of TCGplayer's catalog. TCGplayer's own API takes no new developers. |
| [Scryfall](https://scryfall.com/docs/api) | Magic rules text, artists, Cardmarket (EUR) prices | Free, and links each card to its TCGplayer product. |
| [Pokémon TCG API](https://pokemontcg.io) | Pokémon attacks, abilities, artists, Cardmarket prices | Free; set `POKEMONTCG_API_KEY` for a higher rate limit. |
| [eBay Browse API](https://developer.ebay.com) | eBay comp: median asking price of matching Buy It Now listings (raw, or the card's grader and grade) | Free developer app; set `EBAY_CLIENT_ID` and `EBAY_CLIENT_SECRET`. eBay has no free sold-price data. |
| [PriceCharting API](https://www.pricecharting.com/api-documentation) | PriceCharting comp: ungraded or graded sold price | Needs a PriceCharting subscription; set `PRICECHARTING_TOKEN`. |
| [YGOPRODeck](https://ygoprodeck.com/api-guide/) | Yu-Gi-Oh! card text, every printing, Cardmarket and eBay prices | Free. |

How it fits together:
- Each night (TCGCSV publishes around 20:00 UTC) the server copies the card list and prices into Supabase: `catalog_sets`, `catalog_cards`, `catalog_prices`. Sets whose card list hasn't changed only get new prices. A full load is about two requests per set, well under TCGCSV's 10,000 a day.
- `price_history` gets one row per day for every card someone owns (`TX_HISTORY=all` keeps every card; that grows by roughly 300,000 rows a day).
- Earlier history: when someone starts owning a card, `server/backfill.js` fills in its prices for each of the last 30 days and one a week back to a year from TCGCSV's daily price archives (7-Zip files, opened with the `7z-wasm` package, the server's only dependency). It runs after the nightly load and when a chart asks for a card with little history.
- Search (`/api/search`) runs in Postgres (`search_catalog`). Until the database is loaded, or when it has no match, Magic, Pokémon and Yu-Gi-Oh! searches go live to Scryfall, the Pokémon TCG API and YGOPRODeck.
- Card details from those sites are cached in `card_details` for a week.
- In the page, cards are linked to a TCGplayer printing (`src.tcg`, and `src.sub` for the price type such as Holofoil). Linked cards get today's price on load and draw their price history from the server.

Setup:
1. Run `supabase/catalog.sql` in the Supabase SQL editor (after `schema.sql`).
2. On the server, set `SUPABASE_SERVICE_ROLE_KEY` to the project's secret key (Supabase → Project Settings → API Keys). It stays on the server; the page never sees it.
3. Restart. The first load starts a minute later and takes a while; `GET /api/catalog/status` shows the last run.

Optional settings: `TX_CATALOG_GAMES` (comma list such as `magic,pokemon,lorcana`, or `all`), `TX_HISTORY=all`, `TX_CATALOG_SCHEDULE=off`, `TX_ADMIN_TOKEN` (lets `POST /api/catalog/ingest` with an `x-admin-token` header start a load by hand), `POKEMONTCG_API_KEY`, `EBAY_CLIENT_ID` + `EBAY_CLIENT_SECRET`, `PRICECHARTING_TOKEN`. Without the eBay or PriceCharting keys those two boxes show a search link instead of a price.
