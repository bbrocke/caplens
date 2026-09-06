-- Prepared corrections; not applied. Current NHL roster snapshot: 2026-09-06.
-- Only current player affiliations change. Historical contract team IDs stay intact.
BEGIN;
CREATE TEMP TABLE roster_corrections (id uuid PRIMARY KEY, nhl_player_id bigint, old_team text, new_team text) ON COMMIT DROP;
INSERT INTO roster_corrections VALUES
('c1fcbe91-229e-47e4-bd05-6c505d285c9a'::uuid, 8476399, 'CGY', 'MIN'),
('6e6b0bee-d866-4974-bacf-c7e0c7ecaef9'::uuid, 8477498, 'EDM', 'SJS'),
('c341cb9f-6b80-4a50-a3ba-c1c1ded41ea7'::uuid, 8482221, 'BUF', 'EDM'),
('8293f005-629c-4b0d-a10c-941426de65d4'::uuid, 8478136, 'MIN', 'CGY'),
('8d340cbc-71e5-4c8d-af8c-55d39f4e4e7a'::uuid, 8476914, 'BOS', 'NYR'),
('5bd6603d-4838-463a-a13f-36acbea8e656'::uuid, 8478434, 'VGK', 'DET'),
('49d1761b-f4da-4a7f-9ca4-32384b710381'::uuid, 8482146, 'NSH', 'NJD'),
('23c26cf6-9d78-4212-9713-47f845e46e06'::uuid, 8477969, 'VAN', 'NYR'),
('f158b9d0-0812-4684-8a2c-42929791ddda'::uuid, 8477426, 'TBL', 'TOR'),
('5ea5a76e-f3a7-4dcf-8477-335b8f7d9029'::uuid, 8476874, 'CGY', 'MIN'),
('4cba100f-6e56-4cd0-a2ec-26462c7e48ab'::uuid, 8480434, 'UTA', 'NYR'),
('72c404e8-c80a-43ec-9cf1-8d7ee1a5fc1f'::uuid, 8482166, 'SJS', 'EDM'),
('15089ebb-8c6d-47b2-80b4-e82850ab76ab'::uuid, 8476389, 'NYR', 'UTA'),
('73b1577d-8323-4baa-9ac7-801bab35ee2a'::uuid, 8478840, 'NYR', 'BOS');
DO $$
BEGIN
  IF (SELECT count(*) FROM roster_corrections c JOIN public.players p ON p.id=c.id AND p.nhl_player_id=c.nhl_player_id JOIN public.teams t ON t.id=p.team_id AND t.abbreviation=c.old_team JOIN public.teams n ON n.abbreviation=c.new_team) <> 14 THEN
    RAISE EXCEPTION 'Roster correction preconditions changed; re-audit before applying';
  END IF;
END $$;
UPDATE public.players p SET team_id=t.id
FROM roster_corrections c JOIN public.teams t ON t.abbreviation=c.new_team
WHERE p.id=c.id;
DO $$
BEGIN
  IF (SELECT count(*) FROM roster_corrections c JOIN public.players p ON p.id=c.id JOIN public.teams t ON t.id=p.team_id AND t.abbreviation=c.new_team) <> 14 THEN
    RAISE EXCEPTION 'Roster correction validation failed';
  END IF;
END $$;
-- Deliberately roll back for review/validation. Change only after release approval.
ROLLBACK;
