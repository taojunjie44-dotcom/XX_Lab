-- Username-only synchronization for Velocity Lab.
-- WARNING: this intentionally provides no real authentication. Anyone who knows
-- an account name can read or replace that account's data.

create table if not exists public.athlete_data (
  account text primary key check (account ~ '^[[:alnum:]_-]{3,24}$'),
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.athlete_data enable row level security;

create policy "public username read"
on public.athlete_data for select
to anon
using (true);

create policy "public username insert"
on public.athlete_data for insert
to anon
with check (true);

create policy "public username update"
on public.athlete_data for update
to anon
using (true)
with check (true);

grant select, insert, update on public.athlete_data to anon;
