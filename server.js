const http = require('http');
const fs = require('fs');
const path = require('path');
const api = require('./server/api');
const ingest = require('./server/ingest');

const PORT = process.env.PORT || 3000;
const FILE = path.join(__dirname, 'index.html');
const TYPES = { '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' };

http.createServer((req, res) => {
  if (req.url === '/health') { res.writeHead(200); return res.end('ok'); }
  // Card search, details, market prices and price history (server/api.js).
  if (req.url.startsWith('/api/')) return api.handle(req, res);
  // Sign-in settings for the page. The publishable key is public by design; row-level security protects the data.
  // Set SUPABASE_URL to an empty string to run without accounts (data saved only in the browser).
  if (req.url.split('?')[0].endsWith('/config.js')) {
    const env = process.env, p = env.SUPABASE_PROVIDERS;
    const url = env.SUPABASE_URL ?? 'https://ujjbfxcmeaoevoisgerl.supabase.co';
    const anonKey = env.SUPABASE_ANON_KEY ?? 'sb_publishable_vM-Z1zjWzfgN9jftfcYK4w_AmuLPAfJ';
    const cfg = url && anonKey ? { url, anonKey, providers: (p || '').split(',').map(s => s.trim()).filter(Boolean) } : null;
    res.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8', 'Cache-Control': 'no-store' });
    // TX_SERVER tells the page this server's /api/* card lookups are available.
    return res.end('window.TX_SERVER=true;' + (cfg ? 'window.TX_SUPABASE=' + JSON.stringify(cfg) + ';' : ''));
  }
  // App modules in css/ and js/. Matched at the end of the path so the page still works when served from any URL.
  const asset = /\/(css|js)\/([\w.-]+\.(?:css|js))$/.exec(req.url.split('?')[0]);
  if (asset) {
    return fs.readFile(path.join(__dirname, asset[1], asset[2]), (err, data) => {
      if (err) { res.writeHead(404); return res.end('not found'); }
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(asset[2])] });
      res.end(data);
    });
  }
  // Public privacy policy and terms, linked from Google's sign-in setup.
  const legal = /^\/(privacy|terms)(\.html)?\/?$/.exec(req.url.split('?')[0]);
  if (legal) {
    return fs.readFile(path.join(__dirname, legal[1] + '.html'), (err, data) => {
      if (err) { res.writeHead(404); return res.end('not found'); }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(data);
    });
  }
  fs.readFile(FILE, (err, data) => {
    if (err) { res.writeHead(500); return res.end('index.html not found'); }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(data);
  });
}).listen(PORT, '0.0.0.0', () => {
  console.log('Tradéx running on port ' + PORT);
  // Loads the card database each night once TCGCSV publishes new prices (needs SUPABASE_SERVICE_ROLE_KEY).
  if (!ingest.schedule()) console.log('[catalog] nightly card database load is off: set SUPABASE_SERVICE_ROLE_KEY to turn it on');
});
