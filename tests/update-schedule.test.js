const assert = require("node:assert/strict");
const {
  buildMatchUrl,
  inferMatchGroup,
  inferMatchGroupForStage,
  isSeasonStage,
  normalizeLogoUrl,
  normalizeStatus,
  normalizeUpdatedAt,
  parseTeamListScript,
  resolveSeasonConfig,
  transformSchedule,
} = require("../scripts/update-schedule");

assert.deepEqual(resolveSeasonConfig({}), { year: 2026, stage: "第三赛段" });
assert.deepEqual(
  resolveSeasonConfig({ LPL_YEAR: "2027", LPL_STAGE: "第一赛段" }),
  { year: 2027, stage: "第一赛段" }
);
assert.throws(() => resolveSeasonConfig({ LPL_YEAR: "abc" }), /LPL_YEAR 无效/);
assert.throws(
  () => resolveSeasonConfig({ LPL_STAGE: " " }),
  /LPL_STAGE 不能为空/
);

assert.equal(normalizeStatus("1"), "upcoming");
assert.equal(normalizeStatus("2"), "live");
assert.equal(normalizeStatus("3"), "finished");
assert.equal(inferMatchGroup("TT", "EDG"), "登峰组");
assert.equal(inferMatchGroup("NIP", "WBG"), "涅槃组");
assert.equal(inferMatchGroup("TT", "WBG"), "");
assert.equal(inferMatchGroupForStage("第三赛段组内赛", "TT", "EDG"), "登峰组");
assert.equal(inferMatchGroupForStage("第三赛段骑士之路", "TT", "WBG"), "");
assert.equal(isSeasonStage("第三赛段组内赛"), true);
assert.equal(isSeasonStage("2026赛季季后赛"), true);
assert.equal(isSeasonStage("资格赛"), true);
assert.equal(isSeasonStage("第二赛段组内赛"), false);
assert.equal(
  normalizeUpdatedAt("2026-07-26 16:45:05"),
  "2026-07-26T16:45:05+08:00"
);
assert.equal(
  normalizeLogoUrl("//img.example.com/tt.png"),
  "https://img.example.com/tt.png"
);
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

const observedAt = "2026-07-26T17:05:00+08:00";
const schedule = transformSchedule(fixture, teamFixture, null, observedAt);
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
  phase: "",
  group: "登峰组",
  leftScore: 1,
  rightScore: 0,
  scoreUpdatedAt: observedAt,
  finishedAt: null,
  liveUrl: "https://lpl.qq.com/web202301/live.html?bgid=237&bmid=1",
});

const updatedSchedule = transformSchedule(
  {
    ...fixture,
    msg: [
      {
        ...fixture.msg[0],
        MatchStatus: "3",
        ScoreA: "2",
        ScoreB: "0",
      },
    ],
  },
  teamFixture,
  schedule,
  "2026-07-26T18:25:00+08:00"
);
assert.equal(
  updatedSchedule.matches[0].finishedAt,
  "2026-07-26T18:25:00+08:00"
);
assert.equal(
  updatedSchedule.matches[0].scoreUpdatedAt,
  "2026-07-26T18:25:00+08:00"
);

const gameScoreSchedule = transformSchedule(
  {
    ...fixture,
    msg: [
      {
        ...fixture.msg[0],
        ScoreA: "1",
        ScoreB: "1",
      },
    ],
  },
  teamFixture,
  schedule,
  "2026-07-26T17:45:00+08:00"
);
assert.equal(gameScoreSchedule.matches[0].leftScore, 1);
assert.equal(gameScoreSchedule.matches[0].rightScore, 1);
assert.equal(
  gameScoreSchedule.matches[0].scoreUpdatedAt,
  "2026-07-26T17:45:00+08:00"
);
assert.equal(gameScoreSchedule.matches[0].finishedAt, null);

const playoffSchedule = transformSchedule(
  {
    ...fixture,
    msg: [
      {
        ...fixture.msg[0],
        GameTypeName: "第三赛段淘汰赛",
        GameProcName: "败者组决赛",
        TeamShortNameA: "TT",
        TeamShortNameB: "WBG",
        GameModeName: "BO5",
      },
    ],
  },
  teamFixture,
  null,
  observedAt
);
assert.equal(playoffSchedule.matches[0].stage, "第三赛段淘汰赛");
assert.equal(playoffSchedule.matches[0].phase, "败者组决赛");
assert.equal(playoffSchedule.matches[0].group, "");
assert.equal(playoffSchedule.matches[0].matchType, "BO5");

const renamedPlayoffSchedule = transformSchedule(
  {
    ...fixture,
    msg: [
      {
        ...fixture.msg[0],
        GameTypeName: "2026赛季季后赛",
        GameModeName: "BO5",
      },
    ],
  },
  teamFixture,
  null,
  observedAt
);
assert.equal(renamedPlayoffSchedule.matches.length, 1);
assert.equal(renamedPlayoffSchedule.matches[0].stage, "2026赛季季后赛");

assert.throws(
  () => transformSchedule({ status: "0", msg: [] }),
  /没有 2026 LPL 第三赛段赛程/
);

console.log("schedule updater: ok");
