const assert = require("node:assert/strict");
const { convertCitoWorlds } = require("../scripts/worlds-cito-convert");

const observedAt = "2026-10-26T16:00:00.000Z";
const team = (slug, code, score = 0, outcome) => ({
  slug,
  name: code === "TBD" ? "TBD" : `${code} Esports`,
  code,
  score,
  ...(outcome ? { outcome } : {}),
});
const event = (matchId, startTime, state, teams, count = 5) => ({
  matchId,
  startTime,
  state,
  type: "match",
  blockName: "Finals",
  tournamentId: "lol-worlds_2026",
  leagueId: "lol-worlds",
  leagueName: "Worlds",
  teams,
  strategy: { type: "bestOf", count },
});
const finished = event("lol-match-10001", "2026-10-25T19:00:00Z", "completed", [
  team("kc", "KC", 3, "win"),
  team("c9", "C9", 2, "loss"),
]);
const final = event(
  "lol-match-10002",
  "2026-11-14T19:00:00.000Z",
  "unstarted",
  [team("tbd", "TBD"), team("tbd", "TBD")]
);
const page = (events, hasMore = false, offset = 0, total = events.length) => ({
  success: true,
  data: {
    leagueId: "lol-worlds",
    leagueName: "Worlds",
    total,
    count: events.length,
    limit: 100,
    offset,
    hasMore,
    events,
  },
});

const converted = convertCitoWorlds([page([finished, final])], { observedAt });
assert.equal(converted.schedule.matches.length, 2);
assert.equal(converted.schedule.classification, "PARTIAL_OBSERVED");
assert.equal(converted.schedule.sourceAuthorization, "NOT_VERIFIED");
assert.equal(converted.schedule.coverageVerified, false);
assert.equal(converted.schedule.coverageStart, "2026-10-26");
assert.equal(converted.schedule.coverageEnd, "2026-11-15");
assert.equal(converted.schedule.matches[0].startTime, "2026-10-26 03:00:00");
assert.equal(converted.schedule.matches[0].leftScore, 3);
assert.equal(converted.schedule.matches[0].participants.left.id, "kc");
assert.equal(converted.schedule.matches[1].startTime, "2026-11-15 03:00:00");
assert.equal(converted.schedule.matches[1].matchType, "BO5");
assert.equal(converted.schedule.matches[1].left, "TBD");
assert.equal(converted.schedule.matches[1].leftScore, null);
assert.equal(converted.schedule.matches[1].participants.left.id, "tbd");
assert.deepEqual(converted.audit.addedIds, [
  "lol-match-10001",
  "lol-match-10002",
]);

assert.throws(
  () => convertCitoWorlds([page([finished, finished])], { observedAt }),
  /duplicate/i
);
assert.throws(
  () =>
    convertCitoWorlds([page([{ ...final, leagueId: "lol-lpl" }])], {
      observedAt,
    }),
  /identity/i
);
assert.throws(
  () => convertCitoWorlds([page([final], true)], { observedAt }),
  /pagination/i
);
assert.throws(
  () =>
    convertCitoWorlds([page([{ ...final, state: "unknown" }])], { observedAt }),
  /state/i
);
assert.throws(
  () =>
    convertCitoWorlds(
      [page([{ ...final, teams: [team("kc", "KC"), team("kc", "KC")] }])],
      { observedAt }
    ),
  /same team/i
);
const missing = convertCitoWorlds([page([finished])], {
  observedAt,
  previousSchedule: converted.schedule,
});
assert.deepEqual(missing.audit.removedIds, ["lol-match-10002"]);
assert.equal(missing.audit.publicationBlocked, true);
console.log("worlds Cito conversion: ok");
