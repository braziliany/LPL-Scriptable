const assert = require("node:assert/strict");
const {
  convertCitoWorlds,
  SOURCE_URL,
  LEAGUE_ID,
} = require("../LPL-Cito-Worlds");
const {
  loadPersonalCitoSchedule,
  readPersonalCache,
  personalPaths,
} = require("../LPL-Cito-Personal");

const files = new Map();
const fm = {
  documentsDirectory: () => "/local",
  joinPath: (directory, name) => `${directory}/${name}`,
  fileExists: (target) => files.has(target),
  readString: (target) => files.get(target),
  writeString: (target, content) => files.set(target, content),
  copy: (from, to) => {
    if (files.has(to)) throw new Error("destination exists");
    files.set(to, files.get(from));
  },
  move: (from, to) => {
    if (failCurrentMove && to === personalPaths(fm).current)
      throw new Error("simulated write interruption");
    files.set(to, files.get(from));
    files.delete(from);
  },
  remove: (target) => files.delete(target),
};
let failCurrentMove = false;
let statusCode = 200;
let requests = 0;
let payload;
class MockRequest {
  constructor(url) {
    assert.match(url, /^https:\/\/api\.citoapi\.com\//);
  }
  async loadJSON() {
    requests++;
    assert.equal(this.headers["x-api-key"], "synthetic-key");
    this.response = { statusCode };
    if (statusCode !== 200) throw new Error("mock HTTP failure");
    return payload;
  }
}
const event = (state = "unstarted") => ({
  matchId: "lol-match-115660540726095057",
  startTime: "2026-10-26T22:00:00.000Z",
  state,
  type: "match",
  blockName: "Swiss",
  tournamentId: "lol-worlds_2026",
  leagueId: "lol-worlds",
  leagueName: "Worlds",
  teams: [
    {
      slug: "tl",
      name: "Team Liquid",
      code: "TLAW",
      score: state === "completed" ? 2 : 0,
      outcome: state === "completed" ? "win" : undefined,
    },
    {
      slug: "al",
      name: "Anyone's Legend",
      code: "AL",
      score: state === "completed" ? 1 : 0,
      outcome: state === "completed" ? "loss" : undefined,
    },
  ],
  strategy: { type: "bestOf", count: 3 },
});
const page = (events) => ({
  success: true,
  data: {
    leagueId: "lol-worlds",
    leagueName: "Worlds",
    total: events.length,
    count: events.length,
    offset: 0,
    limit: 100,
    hasMore: false,
    events,
  },
});
payload = page([event()]);
const load = (now, forceRefresh = false) =>
  loadPersonalCitoSchedule({
    key: "synthetic-key",
    fm,
    Request: MockRequest,
    convertCitoWorlds,
    sourceUrl: SOURCE_URL,
    leagueId: LEAGUE_ID,
    now: new Date(now),
    isWidget: true,
    withTimeout: async (operation) => operation(),
    forceRefresh,
  });

(async () => {
  const first = await load("2026-10-26T21:00:00.000Z");
  assert.equal(first.cacheState, "REFRESHED");
  assert.equal(first.schedule.matches.length, 1);
  assert.equal(requests, 1);
  const original = files.get(personalPaths(fm).current);
  const fresh = await load("2026-10-26T22:00:00.000Z");
  assert.equal(fresh.cacheState, "FRESH");
  assert.equal(requests, 1);

  statusCode = 429;
  const stale = await load("2026-10-27T01:00:00.000Z");
  assert.equal(stale.cacheState, "STALE");
  assert.equal(files.get(personalPaths(fm).current), original);
  assert.equal(requests, 2);
  await load("2026-10-27T01:01:00.000Z");
  assert.equal(requests, 2, "backoff should prevent an immediate retry");

  statusCode = 200;
  payload = page([event("completed")]);
  const refreshed = await load("2026-10-27T01:16:00.000Z");
  assert.equal(refreshed.cacheState, "REFRESHED");
  assert.equal(refreshed.schedule.matches[0].status, "finished");
  assert.equal(files.get(personalPaths(fm).backup), original);

  files.set(personalPaths(fm).current, "{broken");
  const recovered = readPersonalCache(
    fm,
    new Date("2026-10-27T01:17:00.000Z"),
    convertCitoWorlds
  );
  assert.equal(recovered.recovered, true);
  assert.equal(recovered.schedule.matches[0].status, "upcoming");

  files.set(personalPaths(fm).current, original);
  payload = page([]);
  const incomplete = await load("2026-10-27T05:00:00.000Z");
  assert.equal(incomplete.cacheState, "STALE");
  assert.equal(files.get(personalPaths(fm).current), original);

  payload = page([event("completed")]);
  failCurrentMove = true;
  const interrupted = await load("2026-10-27T05:06:00.000Z");
  assert.equal(interrupted.cacheState, "STALE");
  assert.equal(files.get(personalPaths(fm).current), original);

  await assert.rejects(load("2026-10-28T23:00:00.000Z"), /过期|不可用/);
  console.log("worlds Cito personal cache and fallback: ok");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
