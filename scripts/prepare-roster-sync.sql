-- Run once in the Supabase SQL Editor before the roster sync.
-- NHL player IDs remain stable when a player changes teams.
alter table public.players
  add column if not exists nhl_player_id bigint;

create unique index if not exists players_nhl_player_id_unique
  on public.players (nhl_player_id);

-- Arizona is not a 2025-26 NHL club. Reuse the existing row when this
-- project was seeded with ARI; otherwise create Utah.
update public.teams
set
  abbreviation = 'UTA',
  name = 'Utah Mammoth',
  conference = 'Western',
  division = 'Central',
  cap_limit = 95500000
where abbreviation = 'ARI'
  and not exists (
    select 1 from public.teams where abbreviation = 'UTA'
  );

insert into public.teams (
  name,
  abbreviation,
  conference,
  division,
  cap_limit
)
select
  'Utah Mammoth',
  'UTA',
  'Western',
  'Central',
  95500000
where not exists (
  select 1 from public.teams where abbreviation = 'UTA'
);
