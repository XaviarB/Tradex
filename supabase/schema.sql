-- Tradéx accounts: one collection per signed-in user.
-- Run once in the Supabase SQL editor (Dashboard → SQL → New query).
-- Row-level security makes the database itself enforce that people can only read and write their own rows.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  handle text unique check (handle ~ '^[a-z0-9_]{3,24}$'),
  display_name text,
  settings jsonb not null default '{}',  -- page backgrounds and other per-account display choices
  created_at timestamptz not null default now()
);

create table if not exists public.binders (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null,
  game text,
  pages int check (pages > 0),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (owner_id, name)
);

-- One row per owned stack of a card. The typed columns are what market data and analytics read;
-- `extra` keeps the rest of the app's card fields (price history, rules text, sources...) as sent.
create table if not exists public.cards (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null,
  set_name text,
  number text,
  game text,
  rarity text,
  condition text,
  finish text,
  grader text,
  grade text,
  qty int not null default 1 check (qty > 0),
  paid numeric,
  market_usd numeric,
  listed_price numeric,
  acquired text,
  collected_on text,
  notes text,
  image_url text,
  extra jsonb not null default '{}',
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists cards_owner_updated on public.cards (owner_id, updated_at);
create index if not exists binders_owner_updated on public.binders (owner_id, updated_at);

create table if not exists public.binder_cards (
  binder_id uuid not null references public.binders on delete cascade,
  card_id uuid not null references public.cards on delete cascade,
  owner_id uuid not null default auth.uid() references auth.users on delete cascade,
  primary key (binder_id, card_id)
);

-- The server clock decides updated_at, so sync never trusts a device's clock.
create or replace function public.touch() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;
drop trigger if exists cards_touch on public.cards;
create trigger cards_touch before insert or update on public.cards for each row execute function public.touch();
drop trigger if exists binders_touch on public.binders;
create trigger binders_touch before insert or update on public.binders for each row execute function public.touch();

alter table public.profiles enable row level security;
alter table public.binders enable row level security;
alter table public.cards enable row level security;
alter table public.binder_cards enable row level security;

drop policy if exists "own profile" on public.profiles;
create policy "own profile" on public.profiles for all using (id = auth.uid()) with check (id = auth.uid());
drop policy if exists "own binders" on public.binders;
create policy "own binders" on public.binders for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
drop policy if exists "own cards" on public.cards;
create policy "own cards" on public.cards for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
drop policy if exists "own binder cards" on public.binder_cards;
create policy "own binder cards" on public.binder_cards for all using (owner_id = auth.uid())
  with check (owner_id = auth.uid()
    and exists (select 1 from public.binders b where b.id = binder_id and b.owner_id = auth.uid())
    and exists (select 1 from public.cards c where c.id = card_id and c.owner_id = auth.uid()));

-- A profile row for every new account.
create or replace function public.new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin insert into public.profiles (id) values (new.id) on conflict do nothing; return new; end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.new_user();

-- Photos people upload (cards and page backgrounds). Files live under <user id>/ with random names,
-- are readable by link (so share pages can show them later) and only writable by their owner.
insert into storage.buckets (id, name, public) values ('card-images', 'card-images', true) on conflict do nothing;
drop policy if exists "own card images insert" on storage.objects;
create policy "own card images insert" on storage.objects for insert
  with check (bucket_id = 'card-images' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "own card images update" on storage.objects;
create policy "own card images update" on storage.objects for update
  using (bucket_id = 'card-images' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "own card images delete" on storage.objects;
create policy "own card images delete" on storage.objects for delete
  using (bucket_id = 'card-images' and (storage.foldername(name))[1] = auth.uid()::text);
