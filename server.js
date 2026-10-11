const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const FILE = path.join(__dirname, 'index.html');
const TYPES = { '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' };

http.createServer((req, res) => {
  if (req.url === '/health') { res.writeHead(200); return res.end('ok'); }
  // App modules in css/ and js/. Matched at the end of the path so the page still works when served from any URL.
  const asset = /\/(css|js)\/([\w.-]+\.(?:css|js))$/.exec(req.url.split('?')[0]);
  if (asset) {
    return fs.readFile(path.join(__dirname, asset[1], asset[2]), (err, data) => {
      if (err) { res.writeHead(404); return res.end('not found'); }
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(asset[2])] });
      res.end(data);
    });
  }
  fs.readFile(FILE, (err, data) => {
    if (err) { res.writeHead(500); return res.end('index.html not found'); }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(data);
  });
}).listen(PORT, '0.0.0.0', () => console.log('Tradéx running on port ' + PORT));
