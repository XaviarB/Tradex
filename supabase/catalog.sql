-- Tradéx card database: every trading card TCGplayer sells, with daily market prices and price history.
-- Run once in the Supabase SQL editor (Dashboard → SQL → New query), after schema.sql. Safe to run again.
-- The Tradéx server fills these tables each night from TCGCSV (a daily copy of TCGplayer's catalog and prices),
-- using the secret key in its SUPABASE_SERVICE_ROLE_KEY setting. Everyone can read them; only the server writes.

create extension if not exists pg_trgm;

-- One row per set (TCGplayer "group"). modified_on tells the nightly job when a set's card list changed.
create table if not exists public.catalog_sets (
  group_id int primary key,
  category_id int not null,
  game text not null,
  name text not null,
  abbreviation text,
  released date,
  modified_on timestamptz,
  card_count int,
  updated_at timestamptz not null default now()
);

-- One row per single card printing (sealed product is left out).
create table if not exists public.catalog_cards (
  product_id bigint primary key,           -- TCGplayer product id
  category_id int not null,
  group_id int not null,
  game text not null,                      -- the game name the app uses: Magic, Pokémon, Yu-Gi-Oh!, One Piece, ...
  name text not null,
  clean_name text,
  set_name text,
  set_code text,
  released date,
  number text,
  rarity text,
  card_type text,
  image_url text,
  url text,
  modified_on timestamptz,
  updated_at timestamptz not null default now(),
  search text generated always as (lower(name || ' ' || coalesce(set_name, '') || ' ' || coalesce(set_code, '') || ' ' || coalesce(number, ''))) stored
);
create index if not exists catalog_cards_search on public.catalog_cards using gin (search gin_trgm_ops);
create index if not exists catalog_cards_game_name on public.catalog_cards (game, lower(name));
create index if not exists catalog_cards_group on public.catalog_cards (group_id);

-- Today's TCGplayer prices, one row per card and price sub-type (Normal, Holofoil, Reverse Holofoil, Foil, ...).
create table if not exists public.catalog_prices (
  product_id bigint not null references public.catalog_cards on delete cascade,
  sub text not null,
  day date not null,
  market numeric, low numeric, mid numeric, high numeric, direct_low numeric,
  primary key (product_id, sub)
);

-- One price per card, sub-type and day, for the cards people own (or every card when TX_HISTORY=all).
create table if not exists public.price_history (
  product_id bigint not null,
  sub text not null,
  day date not null,
  market numeric, low numeric, mid numeric, high numeric,
  primary key (product_id, sub, day)
);

-- Card details the server looked up from Scryfall, the Pokémon TCG API or YGOPRODeck (rules text, artist,
-- Cardmarket prices), kept so the same card isn't fetched again for a while.
create table if not exists public.card_details (
  key text primary key,                    -- e.g. tcg:42346, or game|name|set|number for cards without a TCGplayer id
  data jsonb not null,
  fetched_at timestamptz not null default now()
);

-- The nightly job's own notes (when it last ran, which TCGCSV build it loaded).
create table if not exists public.catalog_meta (
  key text primary key,
  value jsonb,
  updated_at timestamptz not null default now()
);

-- Which TCGplayer cards are in someone's collection, so their prices are kept day by day.
-- Only the server reads it (it bypasses row-level security); it lists product ids, never who owns them.
create or replace view public.tracked_products with (security_invoker = true) as
  select distinct (extra -> 'src' ->> 'tcg')::bigint as product_id
  from public.cards
  where deleted_at is null and (extra -> 'src' ->> 'tcg') ~ '^\d+$';
revoke all on public.tracked_products from anon, authenticated;

alter table public.catalog_sets enable row level security;
alter table public.catalog_cards enable row level security;
alter table public.catalog_prices enable row level security;
alter table public.price_history enable row level security;
alter table public.card_details enable row level security;
alter table public.catalog_meta enable row level security;
drop policy if exists "anyone reads" on public.catalog_sets;
create policy "anyone reads" on public.catalog_sets for select using (true);
drop policy if exists "anyone reads" on public.catalog_cards;
create policy "anyone reads" on public.catalog_cards for select using (true);
drop policy if exists "anyone reads" on public.catalog_prices;
create policy "anyone reads" on public.catalog_prices for select using (true);
drop policy if exists "anyone reads" on public.price_history;
create policy "anyone reads" on public.price_history for select using (true);
drop policy if exists "anyone reads" on public.card_details;
create policy "anyone reads" on public.card_details for select using (true);
-- catalog_meta has no policy, so only the server can read or write it.

-- Search: every word must appear in the card's name, set, set code or number. Exact names first, then the
-- closest names, then the newest printings. g limits to one game (null for every game).
create or replace function public.search_catalog(q text, g text default null, lim int default 24)
returns table (product_id bigint, game text, name text, set_name text, set_code text, number text, rarity text,
  card_type text, released date, image_url text, url text, prices jsonb)
language sql stable set search_path = public as $$
  with words as (
    select array_agg('%' || replace(replace(replace(w, '\', '\\'), '%', '\%'), '_', '\_') || '%') as pats
    from regexp_split_to_table(lower(trim(coalesce(q, ''))), '\s+') as w where w <> ''
  )
  select c.product_id, c.game, c.name, c.set_name, c.set_code, c.number, c.rarity, c.card_type, c.released, c.image_url, c.url,
    (select jsonb_object_agg(p.sub, jsonb_build_object('market', p.market, 'low', p.low, 'mid', p.mid, 'high', p.high, 'day', p.day))
       from public.catalog_prices p where p.product_id = c.product_id) as prices
  from public.catalog_cards c, words
  where words.pats is not null and (g is null or c.game = g) and c.search like all (words.pats)
  order by (lower(c.name) = lower(trim(q))) desc, similarity(c.name, q) desc, c.released desc nulls last, c.product_id
  limit least(greatest(coalesce(lim, 24), 1), 60)
$$;

-- Price history for many cards at once: one row per card and sub-type with its days and prices in order.
create or replace function public.price_series(ids bigint[], since date default (current_date - 365))
returns table (product_id bigint, sub text, days date[], market numeric[])
language sql stable set search_path = public as $$
  select h.product_id, h.sub, array_agg(h.day order by h.day), array_agg(h.market order by h.day)
  from public.price_history h
  where h.product_id = any(ids[1:1000]) and h.day >= since and h.market is not null
  group by h.product_id, h.sub
$$;

grant execute on function public.search_catalog(text, text, int) to anon, authenticated;
grant execute on function public.price_series(bigint[], date) to anon, authenticated;
