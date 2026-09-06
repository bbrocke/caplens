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

Resolved explanations: Johnny Gaudreau is already stored as deceased; Logan Couture is already stored as retired. Anze Kopitar's retirement is confirmed by [NHL reporting on August 23, 2026](https://www.nhl.com/news/anze-kopitar-happy-in-retirement-after-storied-nhl-career). His stored active status needs a current-roster correction to retired, while preserving his 2025–26 playing and contract history. Production has not been changed. All 18 remaining absences have now been individually researched; see the classifications below. The table and audit.json preserve the original database snapshot.

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

- Apply and validate the individual classifications below using separate fields for playing team, NHL rights, contract status and roster status; include Kopitar's retired-status correction. Define coverage for the 575 source-only players.
- Verify current contract coverage. The app currently selects 2025–26 contracts; current roster updates alone do not make those current-season comparisons.
- Align contract season, remaining years, cap denominator and labels before publishing current comparisons. NHL announced a $104M upper limit for 2026–27: https://www.nhl.com/news/nhl-nhlpa-announce-team-payroll-ranges-for-next-3-seasons-through-2027-28
- Investigate 65 previously flagged term/date-span differences; entry-level slides may be legitimate.
- Sync now defaults to current and dry-run; it validates all clubs and rejects duplicate IDs before a single atomic upsert. Validate this behavior before applying; it still treats all feed members as active, so coverage must be reviewed first.
- Validate proposed SQL in an isolated database, run lint/build/contract regression checks after code corrections, then verify comparison on mobile before deployment.

## Individual follow-up — September 6, 2026

All 18 searched individually. Findings: 5 unsigned RFAs, 10 signed affiliations, 1 unsigned UFA, 2 overseas. These are draft classifications, not production changes. The API omission itself remains unexplained for signed players; an NHL contract does not prove an active roster slot. Original snapshot values above and in audit.json remain unchanged for traceability.

| Player | Classification | Finding and proposed action | Evidence |
|---|---|---|---|
| Adam Fantilli | unsigned_rfa | Unsigned RFA; retain Columbus rights affiliation; no current signed cap hit. | [Source 1](https://puckpedia.com/player/adam-fantilli) |
| Alexander Nikishin | unsigned_rfa | Unsigned RFA; retain Carolina rights affiliation; no current signed cap hit. | [Source 1](https://puckpedia.com/player/alexander-nikishin) |
| Ben McCartney | signed_affiliation | Utah two-year contract announced June 2025. Keep affiliation; current NHL roster slot unverified. | [Source 1](https://www.nhl.com/utah/news/utah-signs-ben-mccartney-to-two-year-two-way-contract-release-6-11-25) |
| Cam Hebig | signed_affiliation | Utah two-year deal announced July 2025. Keep affiliation; current NHL roster slot unverified. | [Source 1](https://www.nhl.com/utah/news/utah-signs-cameron-hebig-to-two-year-two-way-contract-release-7-17-25) |
| Cutter Gauthier | unsigned_rfa | Unsigned RFA; retain Anaheim rights affiliation; no current signed cap hit. | [Source 1](https://puckpedia.com/player/cutter-gauthier) |
| David Gustafsson | signed_affiliation | Pittsburgh signed him through 2026–27 at $850,000. Keep affiliation; roster slot unverified. | [Source 1](https://www.nhl.com/penguins/news/penguins-avoid-arbitration-and-agree-to-contracts-with-four-players) |
| Ethan Del Mastro | unsigned_rfa | Unsigned RFA; retain Chicago rights affiliation; no current signed cap hit. | [Source 1](https://puckpedia.com/player/ethan-del-mastro) |
| Filip Hallander | signed_affiliation | Pittsburgh contract through 2026–27. Keep affiliation; do not infer current injury status from old reports. | [Source 1](https://www.nhl.com/penguins/news/penguins-sign-forward-filip-hallander-to-a-two-year-contract) |
| Ilya Solovyov | signed_affiliation | Pittsburgh extension confirmed May 2026. Keep affiliation; current NHL roster slot unverified. | [Source 1](https://www.nhl.com/penguins/news/penguins-re-sign-forward-connor-dewar-and-defenseman-ilya-solovyov) |
| Jake Livanavage | signed_affiliation | Pittsburgh entry-level signing confirmed April 2026. Keep affiliation; roster slot unverified. | [Source 1](https://www.nhl.com/penguins/news/penguins-sign-defenseman-jake-livanavage-to-a-two-year-entry-level-contract) |
| Jaxson Stauber | signed_affiliation | Utah two-year contract announced April 2025. Keep affiliation; current NHL roster slot unverified. | [Source 1](https://www.nhl.com/utah/news/utah-signs-stauber-to-two-year-two-way-contract-release-4-29-25) |
| Jonathan Drouin | unsigned_ufa | Listed as UFA after Blues buyout process. Remove current STL playing affiliation; preserve historical contract and review buyout charges. | [Source 1](https://puckpedia.com/player/jonathan-drouin); [Source 2](https://www.nhl.com/blues/news/blues-make-qualifying-offers-to-2-rfas) |
| Oskar Pettersson | signed_affiliation | Ottawa contract listed through 2026–27. Keep affiliation; roster slot unverified. Do not erase entry-level slide years. | [Source 1](https://puckpedia.com/player/oskar-pettersson); [Source 2](https://www.nhl.com/senators/news/senators-sign-forward-oskar-pettersson-to-a-three-year-entry-level-con-344889886) |
| Ryan Graves | signed_affiliation | Pittsburgh contract remains listed through 2028–29, with AHL affiliation. Keep contract; NHL roster slot unverified. Buyout speculation is not a transaction. | [Source 1](https://puckpedia.com/player/ryan-graves) |
| Simon Edvinsson | unsigned_rfa | Unsigned RFA; retain Detroit rights affiliation; no current signed cap hit. | [Source 1](https://puckpedia.com/player/simon-edvinsson) |
| Tyler Boucher | signed_affiliation | Ottawa one-year two-way signing confirmed July 2026. Keep affiliation; current NHL roster slot unverified. | [Source 1](https://www.nhl.com/senators/news/senators-agree-to-terms-with-forward-tyler-boucher-on-a-one-year-two-way-contract) |
| Vyacheslav Buteyets | overseas | Shanghai loan announced July 24, 2026. Classify overseas; preserve Anaheim rights separately. Club page available via indexed search only. | [Source 1](https://hc-dragons.com/news/vyacheslav-buteecz-perehodit-v-shanhaj-dregons-na-pravah-arendy/); [Source 2](https://www.prohockeyrumors.com/2026/07/ducks-rfa-vyacheslav-buteyets-signs-in-khl.html) |
| Zakhar Bardakov | overseas | SKA announced a deal through 2026–27. Classify overseas; preserve Colorado rights separately. Club page available via indexed search only. | [Source 1](https://www.ska.ru/news/view/485765-ska-podpisal-kontrakt-s-zakharom-bardakovym/); [Source 2](https://www.prohockeyrumors.com/2026/07/zakhar-bardakov-expected-to-sign-in-khl.html) |

Do not use historical injuries to infer current injured-reserve status. Do not turn RFA rights affiliation into a signed contract or copy old cap hits into 2026–27. For overseas players, retain NHL rights separately from the KHL playing club. For Drouin, preserve historical and buyout accounting separately from current playing affiliation. The 10 signed affiliations still need roster-slot verification before active-roster cap totals are claimed accurate.

## Contract verification — September 6, 2026

All ten signed affiliations have contracts covering 2026–27. Values below are from each linked season table, not the contract summary average. Original club releases support the signings (linked in the individual review). Production unchanged; active NHL roster slots remain unverified.

| Player | Team | Listed contract span | Term | 2026–27 cap hit | Seasons remaining including 2026–27 |
|---|---|---|---|---|---|
| [Ben McCartney](https://puckpedia.com/player/ben-mccartney/contracts) | UTA | 2025-26 to 2026-27 | 2 | $850,000 | 1 |
| [Cam Hebig](https://puckpedia.com/player/cameron-hebig/contracts) | UTA | 2025-26 to 2026-27 | 2 | $812,500 | 1 |
| [David Gustafsson](https://puckpedia.com/player/david-gustafsson/contracts) | PIT | 2026-27 to 2026-27 | 1 | $850,000 | 1 |
| [Filip Hallander](https://puckpedia.com/player/filip-hallander/contracts) | PIT | 2025-26 to 2026-27 | 2 | $850,000 | 1 |
| [Ilya Solovyov](https://puckpedia.com/player/ilya-solovyov/contracts) | PIT | 2026-27 to 2026-27 | 1 | $850,000 | 1 |
| [Jake Livanavage](https://puckpedia.com/player/jake-livanavage/contracts) | PIT | 2025-26 to 2026-27 | 2 | $975,000 | 1 |
| [Jaxson Stauber](https://puckpedia.com/player/jaxson-stauber/contracts) | UTA | 2025-26 to 2026-27 | 2 | $850,000 | 1 |
| [Oskar Pettersson](https://puckpedia.com/player/oskar-pettersson/contracts) | OTT | 2023-24 to 2026-27 | 3 | $910,000 | 1 |
| [Ryan Graves](https://puckpedia.com/player/ryan-graves/contracts) | PIT | 2023-24 to 2028-29 | 6 | $4,500,000 | 3 |
| [Tyler Boucher](https://puckpedia.com/player/tyler-boucher/contracts) | OTT | 2026-27 to 2026-27 | 1 | $850,000 | 1 |

### Corrections required in the data model

- McCartney, Hallander and Stauber: summaries show $812,500, while season tables show $850,000 for 2026–27. Preserve the $775,000 prior-season amount. Older club announcements also predate the new minimum salary; do not apply their original figure to every season.
- Hebig: $812,500 cap hit remains distinct from his $850,000 base salary.
- Pettersson: season table shows a $910,000 cap hit and $945,000 bonus-inclusive AAV for 2026–27; the $860,000 summary is unsuitable for this season. Preserve the three-year term and slide history.
- Livanavage: $975,000 cap hit differs from the source's $1,100,000 bonus-inclusive AAV. Do not equate these fields.
- Gustafsson, Solovyov and Boucher have new 2026–27 deals; preserve expired contracts as history.
- Graves remains contracted through 2028–29. His $4.5M contract cap hit is not automatically the team's net charge under an AHL assignment.

These checks verify publicly reported contracts and season-table values, not access to registered SPCs or a live database correction. Signed status alone does not establish an active NHL roster slot.
