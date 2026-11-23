-- BOT Z Signal Lab · esquema opcional para Supabase (Free Tier)
-- Ejecutar en: Supabase Dashboard > SQL Editor > New query > Run
-- Requiere: Authentication > Sign In / Providers > "Allow anonymous sign-ins" = ON

create table if not exists public.signals (
  owner        uuid not null default auth.uid() references auth.users(id) on delete cascade,
  id           text not null,
  date         date not null,
  time         time not null,
  asset        text not null check (char_length(asset) between 6 and 11),
  market       text not null check (market in ('REAL','OTC')),
  expiry       text not null check (expiry in ('M1','M5')),
  direction    text not null check (direction in ('CALL','PUT')),
  status       text not null check (status in ('Pendiente','Ganada Base','Ganada Gale 1','Ganada Gale 2','Perdida','Omitida')),
  raw_outcome  text,
  verdict      text check (verdict in ('APROBADA','REVISAR','DESCARTADA')),
  confluence   smallint check (confluence between 0 and 5),
  note         text,
  created_at   timestamptz not null default now(),
  primary key (owner, id)
);

create table if not exists public.user_settings (
  owner       uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  settings    jsonb not null,
  updated_at  timestamptz not null default now()
);

create table if not exists public.simulation_log (
  owner   uuid not null default auth.uid() references auth.users(id) on delete cascade,
  id      text not null,
  at      timestamptz not null default now(),
  action  text not null,
  detail  text,
  primary key (owner, id)
);

alter table public.signals        enable row level security;
alter table public.user_settings  enable row level security;
alter table public.simulation_log enable row level security;

-- Cada usuario (incluido el anónimo) solo ve y modifica sus propias filas
do $$
declare t text;
begin
  foreach t in array array['signals','user_settings','simulation_log'] loop
    execute format('drop policy if exists "%1$s_owner_all" on public.%1$s', t);
    execute format(
      'create policy "%1$s_owner_all" on public.%1$s for all to authenticated
         using (owner = (select auth.uid())) with check (owner = (select auth.uid()))', t);
  end loop;
end $$;

create index if not exists signals_owner_date_idx on public.signals (owner, date, time);
