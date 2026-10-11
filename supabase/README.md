# Accounts setup (Supabase)

With these steps, every visitor has to sign in or sign up, and each collection is saved to its owner's account and syncs across devices.
With `SUPABASE_URL` set to an empty string, the app runs as before and saves only in the browser.

1. Create a project at supabase.com.
2. In the SQL editor, run `supabase/schema.sql`. It creates the tables, the privacy rules (each person can only read and write their own rows), and the `card-images` photo bucket.
3. Under Authentication → URL Configuration, set the Site URL to where Tradéx is hosted and add it to the redirect URLs.
4. Optional: turn on the Google and Apple providers under Authentication → Providers.
5. `server.js` already points at the Tradéx project (`ujjbfxcmeaoevoisgerl`) and its publishable key. To use a different project, set these on the server that runs `npm start`:
   - `SUPABASE_URL`: the Project URL. Set it to an empty string to run without accounts.
   - `SUPABASE_ANON_KEY`: the publishable key (`sb_publishable_…`, or the legacy anon key). It's safe in the page because the privacy rules protect the data.
   - `SUPABASE_PROVIDERS`: optional, for example `google,apple`

Never put the service role key in the page or in these variables.

## How sync works
- The browser keeps a full copy, so the app stays instant and works offline. Each save marks the copy as changed, and changed cards and binders go up about a second later.
- On load, when the tab regains focus and when the browser comes back online, the app pulls everything changed since its last pull.
- If the same card was edited on two devices, the device that edited it since its last sync wins.
- Deletes are soft (`deleted_at`), so they reach every device.
- Uploaded photos move out of the browser into the `card-images` bucket, and the card keeps the link.
- The first time someone signs in on a browser that already has a collection, Tradéx asks whether to add those cards to the account. The demo cards are never uploaded, and the old copy is kept in `localStorage.tradex_before_signin`.

`js/account.js` (sync and the sign-in screen) only talks to `window.TXBackend`. `js/backend-supabase.js` is the Supabase version, so a different provider only needs a new backend file.
