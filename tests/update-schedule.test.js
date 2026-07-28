const assert = require("node:assert/strict");
const {
  buildMatchUrl,
  normalizeLogoUrl,
  normalizeStatus,
  normalizeUpdatedAt,
  parseTeamListScript,
  transformSchedule,
} = require("../scripts/update-schedule");

assert.equal(normalizeStatus("1"), "upcoming");
assert.equal(normalizeStatus("2"), "live");
assert.equal(normalizeStatus("3"), "finished");
assert.equal(
  normalizeUpdatedAt("2026-07-26 16:45:05"),
  "2026-07-26T16:45:05+08:00"
);
assert.equal(normalizeLogoUrl("//img.example.com/tt.png"), "https://img.example.com/tt.png");
assert.equal(normalizeLogoUrl("javascript:alert(1)"), "");

const teamFixture = parseTeamListScript(
  'var TeamList={"status":"0","msg":{"11":{"TeamLogo":"//img.example.com/tt.png"},"12":{"TeamLogo":"https://img.example.com/edg.png"}}};'
);
assert.equal(
  buildMatchUrl({
    MatchStatus: "2",
    GameId: "237",
    bMatchId: "13370",
  }),
  "https://lpl.qq.com/web202301/live.html?bgid=237&bmid=13370"
);
assert.equal(
  buildMatchUrl({ MatchStatus: "3", NewsId: "74016", bMatchId: "13087" }),
  "https://lpl.qq.com/web202301/video_detail.shtml?nid=74016"
);
assert.equal(
  buildMatchUrl({ MatchStatus: "3", NewsId: "0", bMatchId: "13087" }),
  "https://lpl.qq.com/web202301/stats.shtml?bmid=13087"
);
assert.equal(
  buildMatchUrl({ MatchStatus: "1", GameId: "237", bMatchId: "13370" }),
  "https://lpl.qq.com/web202301/schedule.html"
);

const fixture = {
  status: "0",
  lastUpTime: "2026-07-26 16:45:05",
  msg: [
    {
      bMatchId: "1",
      GameId: "237",
      MatchDate: "2026-07-26 17:00:00",
      GameName: "2026职业联赛",
      GameTypeName: "第三赛段组内赛",
      TeamShortNameA: "TT",
      TeamShortNameB: "EDG",
      TeamA: "11",
      TeamB: "12",
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

const schedule = transformSchedule(fixture, teamFixture);
assert.equal(schedule.matches.length, 1);
assert.deepEqual(schedule.matches[0], {
  id: "1",
  gameId: "237",
  startTime: "2026-07-26 17:00:00",
  left: "TT",
  right: "EDG",
  leftLogo: "https://img.example.com/tt.png",
  rightLogo: "https://img.example.com/edg.png",
  status: "live",
  matchType: "BO3",
  stage: "第三赛段组内赛",
  leftScore: 1,
  rightScore: 0,
  liveUrl: "https://lpl.qq.com/web202301/live.html?bgid=237&bmid=1",
});

assert.throws(
  () => transformSchedule({ status: "0", msg: [] }),
  /没有 2026 LPL 第三赛段赛程/
);

console.log("schedule updater: ok");
