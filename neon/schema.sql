create table if not exists public.household_state (
  id text primary key check (id = 'household'),
  state jsonb not null,
  version bigint not null default 0,
  updated_at timestamptz not null default now()
);
