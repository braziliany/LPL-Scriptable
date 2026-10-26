// Private Cito schedule probe. Never writes production data.
const fs = require("node:fs");
const path = require("node:path");

const BASE = "https://api.citoapi.com/api/v1";

function leaguesOf(payload) {
  const data = payload?.data ?? payload;
  const leagues = Array.isArray(data) ? data : data?.leagues;
  if (!Array.isArray(leagues))
    throw new Error("Cito league response shape unknown");
  return leagues;
}

function discoverWorldsLeague(payload) {
  const found = leaguesOf(payload).filter((league) => {
    return (
      league?.name === "Worlds" &&
      league?.slug === "worlds" &&
      String(league?.esportsApiId) === "98767975604431411"
    );
  });
  if (found.length !== 1)
    throw new Error(`Expected one Worlds league; found ${found.length}`);
  const id = String(found[0].leagueId ?? "");
  if (!/^[a-zA-Z0-9_-]+$/.test(id)) throw new Error("Worlds league ID invalid");
  return {
    id,
    name: String(found[0].name),
    metadataUpdatedAt: found[0].lastUpdated ?? null,
  };
}

function eventsOf(payload) {
  const data = payload?.data ?? payload;
  const events = Array.isArray(data) ? data : (data?.events ?? data?.matches);
  if (!Array.isArray(events))
    throw new Error("Cito schedule response shape unknown");
  return events;
}

function hasMore(payload, count, limit) {
  const data = payload?.data ?? payload;
  const more =
    payload?.pagination?.hasMore ??
    data?.pagination?.hasMore ??
    payload?.hasMore ??
    data?.hasMore;
  if (typeof more === "boolean") return more;
  if (count >= limit) throw new Error("Cito pagination endpoint unverified");
  return false;
}

function uniqueMatchIds(events) {
  const ids = events.map((event) => String(event?.id ?? event?.matchId ?? ""));
  if (ids.some((id) => !id)) throw new Error("Cito match ID field unverified");
  if (new Set(ids).size !== ids.length)
    throw new Error("Duplicate Cito match ID");
  return ids;
}

async function requestJson(url, key, fetchImpl = fetch) {
  if (!key) throw new Error("CITO_API_KEY missing");
  const response = await fetchImpl(url, {
    headers: { "x-api-key": key, Accept: "application/json" },
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error(`Cito HTTP ${response.status}`);
  return response.json();
}

async function probe({
  key = process.env.CITO_API_KEY,
  knownLeagueId = null,
  fetchImpl = fetch,
} = {}) {
  if (!key) throw new Error("CITO_API_KEY missing");
  if (knownLeagueId !== null && knownLeagueId !== "lol-worlds")
    throw new Error("Cito known league ID invalid");
  const leagues = knownLeagueId
    ? null
    : await requestJson(`${BASE}/lol/leagues`, key, fetchImpl);
  const league = knownLeagueId
    ? { id: "lol-worlds", name: "Worlds", metadataUpdatedAt: null }
    : discoverWorldsLeague(leagues);
  const pages = [];
  let requests = knownLeagueId ? 0 : 1;
  const limit = 100;
  let offset = 0;
  for (let pageIndex = 0; pageIndex < 5; pageIndex++) {
    const query = new URLSearchParams({
      from: "2026-10-14",
      to: "2026-11-16",
      limit: String(limit),
      offset: String(offset),
    });
    const url = `${BASE}/lol/leagues/${encodeURIComponent(league.id)}/schedule?${query}`;
    const page = await requestJson(url, key, fetchImpl);
    requests++;
    const events = eventsOf(page);
    pages.push(page);
    if (!hasMore(page, events.length, limit)) break;
    const nextOffset = (page?.data ?? page)?.nextOffset;
    if (
      events.length === 0 ||
      !Number.isInteger(nextOffset) ||
      nextOffset <= offset ||
      pageIndex === 4
    )
      throw new Error("Cito pagination stalled or exceeded budget");
    offset = nextOffset;
  }
  return {
    league,
    leagues,
    pages,
    requests,
    observedAt: new Date().toISOString(),
  };
}

async function cli(args) {
  const at = args.indexOf("--out");
  const out = at >= 0 ? args[at + 1] : null;
  if (!out || !path.isAbsolute(out) || fs.existsSync(out))
    throw new Error("Use a new absolute --out directory");
  const root = path.resolve(__dirname, "..");
  const relative = path.relative(root, out);
  if (!(
    relative === ".." ||
    relative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relative)
  ))
    throw new Error("Output must be outside repository");
  const knownLeagueAt = args.indexOf("--known-league");
  const result = await probe({
    knownLeagueId: knownLeagueAt >= 0 ? args[knownLeagueAt + 1] : null,
  });
  const events = result.pages.flatMap(eventsOf);
  const ids = uniqueMatchIds(events);
  fs.mkdirSync(out);
  if (result.leagues)
    fs.writeFileSync(
      path.join(out, "cito-leagues.private.json"),
      JSON.stringify(result.leagues, null, 2)
    );
  fs.writeFileSync(
    path.join(out, "cito-schedule.private.json"),
    JSON.stringify(result.pages, null, 2)
  );
  const summary = {
    observedAt: result.observedAt,
    league: result.league,
    requests: result.requests,
    leagueMetadataUpdatedAt: result.league.metadataUpdatedAt,
    rows: events.length,
    uniqueIds: new Set(ids).size,
    needsResponseContractReview: true,
    publicPublicationPermitted: false,
  };
  fs.writeFileSync(
    path.join(out, "audit.json"),
    JSON.stringify(summary, null, 2)
  );
  return { out, ...summary };
}

if (require.main === module)
  cli(process.argv.slice(2))
    .then((result) => console.log(JSON.stringify(result)))
    .catch((error) => {
      console.error(`Cito probe failed: ${error.message}`);
      process.exitCode = 1;
    });

module.exports = {
  BASE,
  discoverWorldsLeague,
  eventsOf,
  hasMore,
  uniqueMatchIds,
  requestJson,
  probe,
  cli,
};
