# Worlds 2026 Cito source integration

This branch adds a **private Cito API probe**, not a production update. No Cito
key is present in the current local environment, and the published Cito
documentation does not show a complete league schedule response. A production
field mapping, Worlds league ID, count, source update time, and account plan
therefore cannot be verified yet. Do not infer these from a Tencent or Riot
snapshot.

## Run after local key configuration

Set `CITO_API_KEY` in the local process environment without writing it to
Git, then use a new private directory outside this repository:

```powershell
npm run worlds:cito-probe -- --out D:\Temp\worlds-cito-probe-YYYYMMDD
```

The probe reads `/lol/leagues`, selects exactly one league explicitly named
Worlds/World Championship and marked 2026, then requests that league's
`/schedule` with inclusive UTC date filters and offset pagination. It does
not guess a league ID. It rejects missing/duplicate match IDs and uncertain
pagination at a full page. Raw responses are saved only in the specified
private directory. The CLI reports counts and shape information, never the
API key or raw data. Missing credentials fail before any request or output
directory creation. Do not publish the raw files.

After a real response is available, verify match fields and build a strict
Cito-to-Worlds converter against that observed contract. Compare the result
once with the existing private Tencent candidate, then add Cito provenance
to the formal match/Active schemas and client. The current production
Worlds file and Active index stay unchanged until this is done.

## Use and quota

Cito's September 2026 Terms allow display in applications with attribution,
but explicitly state that Cito is an independent aggregator without
rights-holder licensing or a rights-cleared feed. Its API licence does not
grant underlying third-party data rights. Public GitHub Raw redistribution
of a transformed Worlds schedule is not expressly cleared by those terms.
Ask Cito about that exact distribution pattern and separately establish any
applicable underlying rights. Keep `sourceAuthorization=NOT_VERIFIED` until
evidence supports a different value.

The published Free tier is 500 requests/month and 10/minute. A three-hour
schedule uses about 248 runs in a 31-day month. One schedule request per run
would fit; rediscovering the league on every run adds another 248 calls and
leaves almost no space for pagination or retries. No three-hour GitHub Action
is enabled until a real Worlds league ID, page count, plan, usage accounting,
data rights, and coverage are verified.

Sources (accessed 2026-10-26):

- https://citoapi.com/docs/api/league-of-legends/
- https://citoapi.com/docs/rate-limits/
- https://citoapi.com/terms/
