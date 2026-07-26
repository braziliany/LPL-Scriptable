const assert = require("node:assert/strict");
const {
  normalizeStatus,
  normalizeUpdatedAt,
  transformSchedule,
} = require("../scripts/update-schedule");

assert.equal(normalizeStatus("1"), "upcoming");
assert.equal(normalizeStatus("2"), "live");
assert.equal(normalizeStatus("3"), "finished");
assert.equal(
  normalizeUpdatedAt("2026-07-26 16:45:05"),
  "2026-07-26T16:45:05+08:00"
);

const fixture = {
  status: "0",
  lastUpTime: "2026-07-26 16:45:05",
  msg: [
    {
      bMatchId: "1",
      MatchDate: "2026-07-26 17:00:00",
      GameName: "2026职业联赛",
      GameTypeName: "第三赛段组内赛",
      TeamShortNameA: "TT",
      TeamShortNameB: "EDG",
      MatchStatus: "2",
      GameModeName: "BO3",
      ScoreA: "1",
      ScoreB: "0",
    },
    {
      bMatchId: "2",
      MatchDate: "2026-01-26 17:00:00",
      GameName: "2026职业联赛",
      GameTypeName: "第一赛段组内赛",
      TeamShortNameA: "WE",
      TeamShortNameB: "TT",
      MatchStatus: "3",
      GameModeName: "BO3",
      ScoreA: "2",
      ScoreB: "0",
    },
  ],
};

const schedule = transformSchedule(fixture);
assert.equal(schedule.matches.length, 1);
assert.deepEqual(schedule.matches[0], {
  id: "1",
  startTime: "2026-07-26 17:00:00",
  left: "TT",
  right: "EDG",
  status: "live",
  matchType: "BO3",
  stage: "第三赛段组内赛",
  leftScore: 1,
  rightScore: 0,
  liveUrl: "https://live.bilibili.com/6",
});

assert.throws(
  () => transformSchedule({ status: "0", msg: [] }),
  /没有 2026 LPL 第三赛段赛程/
);

console.log("schedule updater: ok");
