# Worlds 2026 Cito candidate

## Observed response and identity

On 2026-10-27 00:09:34 Beijing time, an authenticated private probe returned 60
leagues and one exact `Worlds` league (`leagueId=lol-worlds`,
`esportsApiId=98767975604431411`). Its metadata `lastUpdated` was
`2026-10-26T15:45:00.632Z`; this is **league metadata**, not proof that every
schedule row was updated at that time. A date-filtered schedule request
(`2026-10-14` through `2026-11-16` UTC) returned 46 unique matches in one page:
`total=46`, `count=46`, `hasMore=false`. All rows identified
`leagueId=lol-worlds` and `tournamentId=lol-worlds_2026`. The converted
Beijing date range is 2026-10-16 through 2026-11-15. The 2026-11-15 03:00
final is a BO5 TBD–TBD. Coverage remains `PARTIAL_OBSERVED` because Cito's
database total does not independently prove the complete Worlds schedule.

The API response supplies `matchId`, UTC `startTime`, `blockName`, two teams
with code and slug, `strategy.count`, state, score, and completed outcome. The
converter validates these fields and never guesses TBD teams. It stores the
full `lol-match-...` ID and maps the observed league and tournament identities
to the existing formal Worlds schema. The client accepts this Cito identity
only under the same source authorization, coverage, date, and freshness gates
as other Worlds sources. A Cito-backed widget tap opens the official Worlds
page; the private API endpoint is not exposed as a user navigation target.

The previous private Tencent candidate also had 46 rows. Thirty-four rows
matched exactly on ordered team codes, Beijing start time, and BO. Differences
include left/right order, Cito's `ML` versus Tencent's `LOS` code, and three
start times after normalizing team order and that alias: C9–FUR (05:00 versus
07:00 on Oct 17), BLG–TLAW (08:30 versus 08:00 on Oct 25), and GEN–LYON
(05:00 versus 06:00 on Oct 26). This is a local cross-check, not automatic
authority for either source. No Tencent data enters the Cito update path.

## Private update procedure

Keep `CITO_API_KEY` in the process environment. The initial probe discovers
the actual league from `/lol/leagues`. Later probes can reuse the observed
league ID and normally spend one schedule request:

```powershell
$probe = Join-Path $env:LOCALAPPDATA ('LPL-Scriptable\cito-probe-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
npm run worlds:cito-probe -- --known-league lol-worlds --out $probe
$stage = Join-Path $env:LOCALAPPDATA ('LPL-Scriptable\cito-stage-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
npm run worlds:cito-stage -- --probe $probe --out $stage
```

For revision checks, pass `--previous <absolute path to the last private
worlds-2026.candidate.json>` to the stage command. Review `audit.json` for
added, removed, and changed IDs. A missing previous ID blocks publication; it
is never silently deleted. The probe validates pagination and match IDs. The
stage command validates the complete response, formal schema compatibility,
and Active selection before creating a new output directory. Neither command
changes `data/schedules/worlds-2026.json`, `data/active.json`, or any public
pointer. A failed stage therefore leaves the previous candidate untouched.

For a private client technical check only:

```powershell
$env:CITO_PRIVATE_ACTIVE_PATH = Join-Path $stage 'active.candidate.json'
node tests/worlds-production-client.test.js
Remove-Item Env:CITO_PRIVATE_ACTIVE_PATH
```

That optional test overrides authorization and coverage flags **in memory
only** to test parsing. It does not establish publication permission and never
writes a publishable file. The observed private candidate passed this test for
2026-10-27 with four selected matches.

## Publication and quota gates

Cito's terms permit application display with attribution but say Cito is an
independent aggregator, not an official or rights-cleared feed; the service
licence does not grant underlying third-party data rights. The terms do not
expressly clear this project's proposed public GitHub Raw distribution of
transformed schedule JSON. Obtain written confirmation for that exact use and
resolve any underlying rights before setting `sourceAuthorization=VERIFIED`.
Also establish independent evidence for each publishable date window before
setting `coverageVerified=true`. An HTTP success or `total=46` cannot do so.

The Free tier documents 500 requests/month. A three-hour schedule is about
248 runs in a 31-day month. With the observed one-page response and one
request per run, it fits; rediscovering the league on every run takes about
496 requests before retries or extra pages. No scheduled GitHub Action or
public data update is enabled while the rights and coverage gates remain open.
The current client version stays 3.1.3 and the Compact layout is unchanged.

Sources accessed 2026-10-27:

- https://citoapi.com/docs/api/league-of-legends/
- https://citoapi.com/docs/rate-limits/
- https://citoapi.com/terms/
