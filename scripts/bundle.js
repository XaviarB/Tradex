// Inlines css/*.css and js/*.js back into one self-contained page: dist/tradex.html.
// Use it where only a single HTML file can be hosted (for example a Claude artifact).
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');

const html = read('index.html')
  .replace(/<link rel="stylesheet"( id="[\w-]+")? href="(css\/[\w.-]+\.css)">/g, (_, id, f) => `<style${id || ''}>\n${read(f)}</style>`)
  .replace(/<script src="(js\/[\w.-]+\.js)"><\/script>/g, (_, f) => {
    const js = read(f);
    if (/<\/script/i.test(js)) throw new Error(f + ' contains </script and cannot be inlined');
    return `<script>\n${js}</script>`;
  });

fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
fs.writeFileSync(path.join(root, 'dist', 'tradex.html'), html);
console.log('Wrote dist/tradex.html (' + Math.round(html.length / 1024) + ' KB)');
