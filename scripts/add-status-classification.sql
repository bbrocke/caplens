-- Player availability for the 2025-26 dataset.
alter table public.players
  add column if not exists season_status text not null default 'active';

-- How a contract participates in cap accounting.
alter table public.contracts
  add column if not exists cap_status text not null default 'active';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.players'::regclass
      and conname = 'players_season_status_check'
  ) then
    alter table public.players
      add constraint players_season_status_check
      check (season_status in ('active', 'inactive', 'retired', 'deceased'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.contracts'::regclass
      and conname = 'contracts_cap_status_check'
  ) then
    alter table public.contracts
      add constraint contracts_cap_status_check
      check (cap_status in ('active', 'ltir', 'inactive', 'terminated', 'expired', 'unknown'));
  end if;
end
$$;
