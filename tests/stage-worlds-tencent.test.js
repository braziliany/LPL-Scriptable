const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { convertTencentWorlds } = require("../scripts/worlds-tencent-candidate");
const { stageWorldsTencent } = require("../scripts/stage-worlds-tencent");

const root = path.join(__dirname, "..");
const sha = (file) =>
  crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
const productionWorlds = path.join(root, "data/schedules/worlds-2026.json");
const productionActive = path.join(root, "data/active.json");
const before = [sha(productionWorlds), sha(productionActive)];
const observedAt = "2026-10-24T11:37:07.529Z";
const teams = {
  status: "0",
  msg: {
    13: { TeamId: "13", TeamName: "TES", TeamShortName: "TES" },
    15: { TeamId: "15", TeamName: "C9", TeamShortName: "C9" },
    1127: { TeamId: "1127", TeamName: "KC", TeamShortName: "" },
    297: { TeamId: "297", TeamName: "TBD", TeamShortName: "" },
  },
};
const row = (id, time, left, right, status, bo, scoreA, scoreB) => ({
  bMatchId: id,
  GameId: "246",
  GameName: "2026全球总决赛",
  GameTypeName: "瑞士轮",
  GameProcName: "第一天",
  GameModeName: bo,
  MatchDate: time,
  TeamA: left,
  TeamB: right,
  TeamShortNameA: "",
  TeamShortNameB: "",
  MatchStatus: status,
  ScoreA: String(scoreA),
  ScoreB: String(scoreB),
});
const finished = row(
  "13621",
  "2026-10-24 01:00:00",
  "15",
  "1127",
  "3",
  "BO1",
  0,
  1
);
const future = row(
  "13629",
  "2026-10-25 01:00:00",
  "13",
  "1127",
  "1",
  "BO1",
  0,
  0
);
const final = row(
  "13660",
  "2026-11-15 03:00:00",
  "297",
  "297",
  "1",
  "BO5",
  0,
  0
);
final.GameTypeName = "淘汰赛";
const payload = {
  status: "0",
  lastUpTime: "2026-10-24 10:35:06",
  msg: [finished, future, final],
};
const previous = convertTencentWorlds(
  {
    ...payload,
    msg: [finished, { ...future, TeamA: "1127", TeamB: "13" }, final],
  },
  teams,
  { observedAt }
).schedule;
const temp = fs.mkdtempSync(path.join(os.tmpdir(), "lpl-worlds-stage-test-"));
assert.equal(path.dirname(temp), os.tmpdir());
const args = {
  matchesText: JSON.stringify(payload),
  teamsText: `var TeamList = ${JSON.stringify(teams)};`,
  observedAt,
  previousSchedule: previous,
  root,
};

try {
  const outDir = path.join(temp, "approved-candidate");
  const result = stageWorldsTencent({ ...args, outDir });
  assert.equal(result.matchCount, 3);
  assert.equal(result.selectedDate, "2026-10-25");
  assert.equal(result.selectedMatches, 1);
  assert.equal(result.finalStartTime, "2026-11-15 03:00:00");
  assert.equal(result.candidateSchema, "PASS");
  assert.equal(result.productionShape, "PASS_STRUCTURAL_ONLY");
  assert.equal(result.productionGate, "BLOCKED");
  assert.deepEqual(result.addedIds, []);
  assert.deepEqual(result.removedIds, []);
  assert.equal(result.changes.length, 1);
  assert.equal(result.changes[0].id, "13629");
  const stagedSchedule = JSON.parse(
    fs.readFileSync(path.join(outDir, "worlds-2026.candidate.json"), "utf8")
  );
  const stagedActive = JSON.parse(
    fs.readFileSync(path.join(outDir, "active.candidate.json"), "utf8")
  );
  const record = JSON.parse(
    fs.readFileSync(path.join(outDir, "publication-record.json"), "utf8")
  );
  assert.equal(stagedSchedule.matches.length, 3);
  assert.equal(stagedSchedule.classification, "PARTIAL_OBSERVED");
  assert.equal(stagedSchedule.sourceAuthorization, "NOT_VERIFIED");
  assert.equal(stagedSchedule.coverageVerified, false);
  assert.equal(stagedActive.tournament.id, "worlds-2026");
  assert.equal(stagedActive.matches[0].left, "TES");
  assert.equal(record.publishPermitted, false);
  assert.deepEqual(
    [
      record.productionBefore.worldsSha256,
      record.productionBefore.activeSha256,
    ],
    before
  );
  assert.equal(
    record.privateCandidate.worldsSha256,
    sha(path.join(outDir, "worlds-2026.candidate.json"))
  );
  assert.equal(
    record.privateCandidate.activeSha256,
    sha(path.join(outDir, "active.candidate.json"))
  );
  assert.throws(() => stageWorldsTencent({ ...args, outDir }), /不得覆盖/);
  assert.throws(
    () =>
      stageWorldsTencent({
        ...args,
        outDir: path.join(root, "private-worlds"),
      }),
    /仓库外/
  );
  const reduced = stageWorldsTencent({
    ...args,
    outDir: path.join(temp, "reduced-candidate"),
    matchesText: JSON.stringify({ ...payload, msg: [finished, final] }),
  });
  assert.deepEqual(reduced.removedIds, ["13629"]);
  assert.equal(reduced.blockers.includes("PREVIOUS_MATCH_IDS_MISSING"), true);

  const originalCandidateHash = sha(
    path.join(outDir, "worlds-2026.candidate.json")
  );
  const failedOut = path.join(temp, "failed-candidate");
  assert.throws(
    () =>
      stageWorldsTencent({
        ...args,
        outDir: failedOut,
        failurePoint: "beforeCommit",
      }),
    /注入/
  );
  assert.equal(fs.existsSync(failedOut), false);
  assert.equal(
    sha(path.join(outDir, "worlds-2026.candidate.json")),
    originalCandidateHash
  );
  assert.throws(
    () =>
      stageWorldsTencent({
        ...args,
        outDir: path.join(temp, "invalid-candidate"),
        matchesText: JSON.stringify({
          ...payload,
          msg: [future, future, final],
        }),
      }),
    /重复比赛 ID/
  );
  assert.equal(fs.existsSync(path.join(temp, "invalid-candidate")), false);
  assert.deepEqual([sha(productionWorlds), sha(productionActive)], before);
} finally {
  if (path.dirname(temp) === os.tmpdir()) {
    fs.rmSync(temp, { recursive: true, force: true });
  }
}

console.log("Worlds Tencent private staging: ok");
