# Tradéx

A card collection tracker for trading card collectors. Runs entirely in the browser; data is kept in `localStorage`.

## Run it

```
npm start            # http://localhost:3000
npm run bundle       # writes dist/tradex.html, a single self-contained page
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
| `js/main.js` | Sidebar, navigation and filter wiring; first render |
| `js/import.js` | CSV import |
| `js/customizer.js` | Customize (theme) panel |
| `js/listings.js` | Marketplace listings modal |
| `js/ios-preview.js` | iOS device preview |
| `js/nav-wheel.js` | Sidebar scroll wheel |
| `js/owner-gate.js` | Owner password gate (only on a Tradéx server) |
| `css/*.css` | Styles for the app and each panel |
