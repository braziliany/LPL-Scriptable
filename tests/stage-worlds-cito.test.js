const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { stageWorldsCito } = require("../scripts/stage-worlds-cito");

const root = fs.mkdtempSync(path.join(os.tmpdir(), "lpl-cito-stage-"));
const input = path.join(root, "probe");
const output = path.join(root, "candidate");
const rejected = path.join(root, "rejected");
const observedAt = "2026-10-26T16:00:00.000Z";
const final = {
  matchId: "lol-match-115660540726095133",
  startTime: "2026-11-14T19:00:00.000Z",
  state: "unstarted",
  type: "match",
  blockName: "Finals",
  tournamentId: "lol-worlds_2026",
  leagueId: "lol-worlds",
  leagueName: "Worlds",
  teams: [
    { slug: "tbd", name: "TBD", code: "TBD", score: 0 },
    { slug: "tbd", name: "TBD", code: "TBD", score: 0 },
  ],
  strategy: { type: "bestOf", count: 5 },
};
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

try {
  fs.mkdirSync(input);
  fs.writeFileSync(
    path.join(input, "audit.json"),
    JSON.stringify({
      observedAt,
      league: { id: "lol-worlds" },
      requests: 2,
      rows: 1,
      uniqueIds: 1,
      publicPublicationPermitted: false,
    })
  );
  fs.writeFileSync(
    path.join(input, "cito-schedule.private.json"),
    JSON.stringify([page([final])])
  );
  const result = stageWorldsCito({
    input,
    probeDir: input,
    outDir: output,
    now: new Date(observedAt),
  });
  assert.equal(result.audit.matchCount, 1);
  assert.equal(result.audit.selectedDate, "2026-11-15");
  assert.equal(result.audit.schemaValidation, "PASS_PRIVATE_CANDIDATE");
  assert.equal(result.audit.publicationBlocked, true);
  const baseline = fs.readFileSync(
    path.join(output, "worlds-2026.candidate.json"),
    "utf8"
  );
  fs.writeFileSync(
    path.join(input, "cito-schedule.private.json"),
    JSON.stringify([page([final, final])])
  );
  assert.throws(
    () =>
      stageWorldsCito({
        probeDir: input,
        outDir: rejected,
        now: new Date(observedAt),
      }),
    /duplicate/i
  );
  assert.equal(fs.existsSync(rejected), false);
  assert.equal(
    fs.readFileSync(path.join(output, "worlds-2026.candidate.json"), "utf8"),
    baseline
  );
  console.log("worlds Cito private staging: ok");
} finally {
  const resolved = path.resolve(root);
  assert.ok(resolved.startsWith(path.resolve(os.tmpdir()) + path.sep));
  fs.rmSync(resolved, { recursive: true, force: true });
}
