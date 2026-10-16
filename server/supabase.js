// Minimal Supabase (PostgREST) client for the server. Reads use the public key; the card database
// and price history are written with the secret key, which lives only in the server's environment
// (SUPABASE_SERVICE_ROLE_KEY) and never reaches the page.
const { getJSON } = require('./http');

const env = process.env;
const URL_ = () => (env.SUPABASE_URL ?? 'https://ujjbfxcmeaoevoisgerl.supabase.co').replace(/\/$/, '');
const PUBLIC_KEY = () => env.SUPABASE_ANON_KEY ?? 'sb_publishable_vM-Z1zjWzfgN9jftfcYK4w_AmuLPAfJ';
const SECRET_KEY = () => env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SECRET_KEY || '';

const readable = () => !!(URL_() && (SECRET_KEY() || PUBLIC_KEY()));
const writable = () => !!(URL_() && SECRET_KEY());

// New-style keys (sb_publishable_…, sb_secret_…) go in the apikey header only; legacy JWT keys also go in Authorization.
function headers(write) {
  const key = write ? SECRET_KEY() : (SECRET_KEY() || PUBLIC_KEY());
  return key.startsWith('sb_') ? { apikey: key } : { apikey: key, Authorization: 'Bearer ' + key };
}

const rest = (path, opt = {}) => getJSON(URL_() + '/rest/v1/' + path, {
  timeout: 30000, limit: 6, ...opt,
  headers: { ...headers(opt.write), ...(opt.prefer ? { Prefer: opt.prefer } : {}), ...opt.headers },
});

module.exports = {
  readable, writable,
  select: (table, query) => rest(table + '?' + query),
  rpc: (fn, args, write) => rest('rpc/' + fn, { method: 'POST', body: args, write }),
  // Inserts rows, updating the ones that already exist (matched on onConflict columns).
  upsert: (table, rows, onConflict) => rows.length ? rest(table + '?on_conflict=' + onConflict, {
    method: 'POST', body: rows, write: true, prefer: 'resolution=merge-duplicates,return=minimal',
  }) : null,
};
