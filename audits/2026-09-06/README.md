# Current roster audit — 2026-09-06

Status: release blocked; production unchanged.

Reference: NHL `/v1/roster/{club}/current`, all 32 clubs retrieved on 2026-09-06. The current feed includes offseason players and prospects; membership does not prove an active NHL roster slot. Roster IDs, names and positions are retained in rosters.json.

704 database players: 669 team matches, 14 affiliation differences, 21 absent from the feed. 1,258 unique source players, no duplicate IDs across clubs, 575 not in the database. Do not automatically import every prospect or deactivate absent players.

## Prepared affiliation corrections

| Player | Stored | Current feed |
|---|---|---|
| Blake Coleman | CGY | MIN |
| Darnell Nurse | EDM | SJS |
| Devon Levi | BUF | EDM |
| Jake Middleton | MIN | CGY |
| Joonas Korpisalo | BOS | NYR |
| Keegan Kolesar | VGK | DET |
| Luke Evangelista | NSH | NJD |
| Marcus Pettersson | VAN | NYR |
| Nick Paul | TBL | TOR |
| Olli Maatta | CGY | MIN |
| Sean Durzi | UTA | NYR |
| Shakir Mukhamadullin | SJS | EDM |
| Vincent Trocheck | NYR | UTA |
| Will Borgen | NYR | BOS |

`corrections.sql` guards the original IDs and teams, applies all 14 changes within a transaction, verifies the result, and defaults to ROLLBACK. It has not been executed. Contract team IDs are historical and are not copied from current affiliations.

## Players absent from the feed

Absence from the source does not establish retirement, free agency, or inactivity.

Resolved explanations: Johnny Gaudreau is already stored as deceased; Logan Couture is already stored as retired. Anze Kopitar's retirement is confirmed by [NHL reporting on August 23, 2026](https://www.nhl.com/news/anze-kopitar-happy-in-retirement-after-storied-nhl-career). His stored active status needs a current-roster correction to retired, while preserving his 2025–26 playing and contract history. Production has not been changed. This leaves 18 unexplained absences. The table and audit.json preserve the original database snapshot.

| Player | Stored team | Stored status |
|---|---|---|
| Adam Fantilli | CBJ | active |
| Alexander Nikishin | CAR | active |
| Anze Kopitar | LAK | active |
| Ben McCartney | UTA | active |
| Cam Hebig | UTA | active |
| Cutter Gauthier | ANA | active |
| David Gustafsson | PIT | active |
| Ethan Del Mastro | CHI | active |
| Filip Hallander | PIT | active |
| Ilya Solovyov | PIT | active |
| Jake Livanavage | PIT | active |
| Jaxson Stauber | UTA | active |
| Johnny Gaudreau | CBJ | deceased |
| Jonathan Drouin | STL | active |
| Logan Couture | SJS | retired |
| Oskar Pettersson | OTT | active |
| Ryan Graves | PIT | active |
| Simon Edvinsson | DET | active |
| Tyler Boucher | OTT | active |
| Vyacheslav Buteyets | ANA | active |
| Zakhar Bardakov | COL | active |

## Remaining release gates

- Reconcile the remaining 18 unexplained absences with official transactions or player records; prepare and validate Kopitar's retired-status correction; define coverage for the 575 source-only players.
- Verify current contract coverage. The app currently selects 2025–26 contracts; current roster updates alone do not make those current-season comparisons.
- Align contract season, remaining years, cap denominator and labels before publishing current comparisons. NHL announced a $104M upper limit for 2026–27: https://www.nhl.com/news/nhl-nhlpa-announce-team-payroll-ranges-for-next-3-seasons-through-2027-28
- Investigate 65 previously flagged term/date-span differences; entry-level slides may be legitimate.
- Sync now defaults to current and dry-run; it validates all clubs and rejects duplicate IDs before a single atomic upsert. Validate this behavior before applying; it still treats all feed members as active, so coverage must be reviewed first.
- Validate proposed SQL in an isolated database, run lint/build/contract regression checks after code corrections, then verify comparison on mobile before deployment.
