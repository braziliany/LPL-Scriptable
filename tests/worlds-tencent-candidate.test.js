const assert = require("node:assert/strict");
const { convertTencentWorlds } = require("../scripts/worlds-tencent-candidate");

const observedAt = "2026-10-24T02:00:00.000Z";
const teamPayload = {
  status: "0",
  msg: {
    15: { TeamId: "15", TeamName: "C9", TeamShortName: "C9" },
    1127: { TeamId: "1127", TeamName: "KC", TeamShortName: "" },
    297: { TeamId: "297", TeamName: "TBD", TeamShortName: "" },
  },
};
const row = (id, startTime, left, right, status, scoreA, scoreB) => ({
  bMatchId: id,
  GameId: "246",
  GameName: "2026全球总决赛",
  GameTypeName: "瑞士轮",
  GameProcName: "第一天",
  GameModeName: "BO1",
  MatchDate: startTime,
  TeamA: left,
  TeamB: right,
  TeamShortNameA: "",
  TeamShortNameB: "",
  MatchStatus: status,
  ScoreA: String(scoreA),
  ScoreB: String(scoreB),
});
const finished = row("13621", "2026-10-24 01:00:00", "15", "1127", "3", 0, 1);
const pending = row("13660", "2026-11-15 03:00:00", "297", "297", "1", 0, 0);
pending.GameTypeName = "淘汰赛";
pending.GameModeName = "BO5";
const payload = {
  status: "0",
  lastUpTime: "2026-10-24 09:40:06",
  msg: [
    row("500", "2026-10-24 02:00:00", "15", "1127", "1", 0, 0),
    finished,
    pending,
  ],
};
payload.msg[0].GameId = "other";
payload.msg[0].GameName = "2026职业联赛";

const converted = convertTencentWorlds(payload, teamPayload, {
  observedAt,
});
assert.equal(converted.schedule.matches.length, 2);
assert.equal(converted.schedule.coverageStart, "2026-10-24");
assert.equal(converted.schedule.coverageEnd, "2026-11-15");
assert.equal(converted.schedule.classification, "PARTIAL_OBSERVED");
assert.equal(converted.schedule.sourceAuthorization, "NOT_VERIFIED");
assert.equal(converted.schedule.coverageVerified, false);
assert.equal(converted.schedule.matches[0].left, "C9");
assert.equal(converted.schedule.matches[0].right, "KC");
assert.equal(converted.schedule.matches[0].leftScore, 0);
assert.equal(converted.schedule.matches[0].rightScore, 1);
assert.equal(converted.schedule.matches[0].participants.source.eventId, "246");
assert.equal(converted.schedule.matches[1].left, "TBD");
assert.equal(converted.schedule.matches[1].right, "TBD");
assert.equal(converted.schedule.matches[1].participants.left.id, "297");
assert.equal(converted.schedule.matches[1].leftScore, null);
assert.equal(converted.audit.matchCount, 2);
assert.equal(converted.audit.addedIds.length, 2);

const live = row("13622", "2026-10-24 02:00:00", "15", "1127", "2", 1, 1);
live.GameModeName = "BO5";
const liveResult = convertTencentWorlds(
  { ...payload, msg: [live] },
  teamPayload,
  { observedAt }
);
assert.equal(liveResult.schedule.matches[0].status, "live");
assert.equal(liveResult.schedule.matches[0].leftScore, 1);
assert.equal(liveResult.schedule.matches[0].rightScore, 1);

const missing = convertTencentWorlds(
  { ...payload, msg: [finished] },
  teamPayload,
  { observedAt, previousSchedule: converted.schedule }
);
assert.deepEqual(missing.audit.removedIds, ["13660"]);
assert.equal(missing.audit.publicationBlocked, true);
assert.equal(converted.schedule.matches.length, 2);

assert.throws(
  () =>
    convertTencentWorlds(
      { ...payload, msg: [{ ...finished, GameId: "other" }, pending] },
      teamPayload,
      { observedAt }
    ),
  /赛事身份/
);
assert.throws(
  () =>
    convertTencentWorlds(
      { ...payload, msg: [finished, { ...finished }] },
      teamPayload,
      { observedAt }
    ),
  /重复比赛 ID/
);
assert.throws(
  () =>
    convertTencentWorlds(
      { ...payload, lastUpTime: "2026-10-20 09:40:06" },
      teamPayload,
      { observedAt }
    ),
  /数据已过期/
);
console.log("worlds Tencent candidate: ok");
