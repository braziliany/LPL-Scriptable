const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const scriptPath = path.join(__dirname, "..", "LPL-Schedule.js");
const designSystem = require("../LPL-Design-System");
const source = fs.readFileSync(scriptPath, "utf8").replace(
  "await main();",
  `globalThis.__testApi = {
      countdownText,
      buildDiagnosticText,
      findNextMatchDay,
      isWithinFinishedScoreHold,
      applyUserSettings,
      matchRightValue,
      matchSubtitle,
      matchVisualStyle,
      matchWinner,
      matchValueMetrics,
      nextRefreshDate,
      normalizeUserSettings,
      logoCacheFileName,
      teamLogoScale,
      parseOfficialSchedule,
      resolveMatchUrl,
      resolveThemeMode,
      shouldUseCompactMedium,
      sortMatchesByTime,
    };`
);
const context = {
  console,
  Set,
  importModule(name) {
    assert.equal(name, "LPL-Design-System");
    return designSystem;
  },
};

vm.runInNewContext(source, context, { filename: scriptPath });

assert.equal(
  context.__testApi.logoCacheFileName("BLG"),
  "lpl-team-logo-BLG.png"
);
assert.equal(context.__testApi.teamLogoScale("TES"), 1.51);
assert.equal(context.__testApi.teamLogoScale("unknown"), 1.35);

const pageText = [
  "LNG",
  "2026-07-26 15:00",
  "NIP",
  "TT",
  "2026-07-26 17:00",
  "EDG",
  "AL",
  "2026-07-26 19:00",
  "BLG",
].join("\n");

const matches = JSON.parse(
  JSON.stringify(context.__testApi.parseOfficialSchedule(pageText))
);

assert.deepEqual(
  matches.map(({ time, left, right }) => ({ time, left, right })),
  [
    { time: "15:00", left: "LNG", right: "NIP" },
    { time: "17:00", left: "TT", right: "EDG" },
    { time: "19:00", left: "AL", right: "BLG" },
  ]
);

const now = new Date(2026, 6, 26, 16, 30);
const upcoming = {
  dateString: "2026-07-26",
  timestamp: new Date(2026, 6, 26, 17, 0).getTime(),
  time: "17:00",
  left: "TT",
  right: "EDG",
  status: "upcoming",
  matchType: "BO3",
};
const live = {
  ...upcoming,
  status: "live",
  leftScore: 1,
  rightScore: 0,
};
const finished = {
  ...upcoming,
  timestamp: new Date(2026, 6, 26, 15, 0).getTime(),
  time: "15:00",
  status: "finished",
  leftScore: 0,
  rightScore: 2,
};

assert.equal(context.__testApi.countdownText(upcoming, now), "还有30分钟");
assert.equal(
  context.__testApi.countdownText(
    { ...upcoming, timestamp: now.getTime() },
    now
  ),
  "即将开始"
);
assert.equal(context.__testApi.matchRightValue(upcoming, now), "还有30分钟");
assert.equal(
  context.__testApi.matchSubtitle(upcoming, now),
  "还有30分钟 · BO3"
);
assert.equal(
  context.__testApi.matchSubtitle(
    {
      ...upcoming,
      timestamp: new Date(2026, 6, 26, 19, 0).getTime(),
    },
    now
  ),
  "未开始 · BO3"
);
assert.equal(context.__testApi.matchRightValue(live, now), "1-0");
assert.equal(
  context.__testApi.matchSubtitle(
    { ...live, leftScore: 0, rightScore: 0 },
    now
  ),
  "直播中 · 比分待更新 · BO3"
);
assert.equal(context.__testApi.matchWinner(finished), "right");
assert.equal(
  context.__testApi.matchVisualStyle(finished, 0, now).leftOpacity,
  0.5
);
assert.equal(
  context.__testApi.matchVisualStyle(finished, 0, now).rightOpacity,
  1
);
assert.equal(
  context.__testApi.matchVisualStyle(live, 1, now).accent,
  "#FF4D67"
);
assert.equal(
  context.__testApi.matchVisualStyle(upcoming, 1, now).valueColor,
  "#FF7043"
);

assert.deepEqual(
  JSON.parse(
    JSON.stringify(
      context.__testApi
        .sortMatchesByTime([
          {
            ...upcoming,
            timestamp: new Date(2026, 6, 26, 19, 0).getTime(),
            time: "19:00",
          },
          finished,
          live,
        ])
        .map(({ time, status }) => ({ time, status }))
    )
  ),
  [
    { time: "15:00", status: "finished" },
    { time: "17:00", status: "live" },
    { time: "19:00", status: "upcoming" },
  ]
);

const tomorrow = {
  ...upcoming,
  dateString: "2026-07-27",
  timestamp: new Date(2026, 6, 27, 17, 0).getTime(),
};
const recentlyFinished = {
  ...finished,
  finishedAt: "2026-07-26T18:25:00+08:00",
};
assert.equal(
  context.__testApi.isWithinFinishedScoreHold(
    recentlyFinished,
    new Date("2026-07-26T18:34:00+08:00")
  ),
  true
);
assert.equal(
  context.__testApi.findNextMatchDay(
    [recentlyFinished, tomorrow],
    new Date("2026-07-26T18:34:00+08:00")
  ).dateString,
  "2026-07-26"
);
assert.equal(
  context.__testApi.findNextMatchDay(
    [recentlyFinished, tomorrow],
    new Date("2026-07-26T18:36:00+08:00")
  ).dateString,
  "2026-07-27"
);
const nextDay = JSON.parse(
  JSON.stringify(context.__testApi.findNextMatchDay([finished, tomorrow], now))
);
assert.equal(nextDay.dateString, "2026-07-27");
assert.equal(nextDay.offset, 1);

const finalDay = JSON.parse(
  JSON.stringify(context.__testApi.findNextMatchDay([finished], now))
);
assert.equal(finalDay.dateString, "2026-07-26");
assert.equal(finalDay.matches[0].status, "finished");

assert.equal(
  context.__testApi.nextRefreshDate([live], now).getTime() - now.getTime(),
  3 * 60 * 1000
);
assert.equal(
  context.__testApi.nextRefreshDate([upcoming], now).getTime() - now.getTime(),
  5 * 60 * 1000
);
assert.deepEqual(
  JSON.parse(JSON.stringify(context.__testApi.matchValueMetrics("medium"))),
  { fontSize: 28, minimumScaleFactor: 0.6, width: 112 }
);
assert.deepEqual(
  JSON.parse(JSON.stringify(context.__testApi.matchValueMetrics("large"))),
  { fontSize: 22, minimumScaleFactor: 0.65, width: 96 }
);
assert.deepEqual(
  JSON.parse(JSON.stringify(context.__testApi.matchValueMetrics("small"))),
  { fontSize: 28, minimumScaleFactor: 0.6, width: 0 }
);

assert.deepEqual(
  JSON.parse(
    JSON.stringify(
      context.__testApi.normalizeUserSettings({
        dataMode: "REMOTE",
        mediumMatches: 1,
        largeMatches: 1,
        highlightedTeams: ["tt", "未知队伍", "TT", "blg"],
        livePlatform: "BILIBILI",
        cacheHours: 24,
        refreshProfile: "battery",
        themeMode: "LIGHT",
        ignored: true,
      })
    )
  ),
  {
    schemaVersion: 1,
    dataMode: "remote",
    highlightedTeams: ["TT", "BLG"],
    livePlatform: "bilibili",
    cacheHours: 24,
    refreshProfile: "battery",
    themeMode: "light",
  }
);
assert.deepEqual(
  JSON.parse(JSON.stringify(context.__testApi.normalizeUserSettings(null))),
  {
    schemaVersion: 1,
    dataMode: "auto",
    highlightedTeams: ["BLG", "AL", "TES", "WBG"],
    livePlatform: "official",
    cacheHours: 12,
    refreshProfile: "balanced",
    themeMode: "dark",
  }
);

const diagnosticText = context.__testApi.buildDiagnosticText(
  {
    dataMode: "remote",
    highlightedTeams: ["BLG"],
    livePlatform: "official",
    cacheHours: 12,
    refreshProfile: "balanced",
    themeMode: "dark",
  },
  {
    updatedAt: "2026-07-30T10:00:00+08:00",
    source: "remote",
    matches: [upcoming, live],
  },
  "medium",
  new Date("2026-07-30T10:09:00+08:00")
);
assert.match(diagnosticText, /组件版本：2\.3\.1/);
assert.match(diagnosticText, /设计系统：2\.3\.1/);
assert.match(diagnosticText, /设置结构：v1/);
assert.match(diagnosticText, /运行环境：中号组件/);
assert.match(diagnosticText, /缓存状态：有效（9 分钟前）/);
assert.match(diagnosticText, /缓存比赛：2 场/);
assert.match(
  context.__testApi.buildDiagnosticText(
    null,
    null,
    "app",
    new Date("2026-07-30T10:09:00+08:00")
  ),
  /运行环境：应用内运行/
);
assert.equal(context.__testApi.resolveThemeMode("auto", true), "dark");
assert.equal(context.__testApi.resolveThemeMode("auto", false), "light");
assert.equal(context.__testApi.resolveThemeMode("LIGHT", true), "light");

assert.equal(context.__testApi.shouldUseCompactMedium([upcoming, live]), false);
assert.equal(
  context.__testApi.shouldUseCompactMedium([finished, live, upcoming]),
  true
);

assert.equal(
  context.__testApi.resolveMatchUrl(
    { status: "live", liveUrl: "https://lpl.qq.com/match/1" },
    "bilibili"
  ),
  "https://live.bilibili.com/6"
);
assert.equal(
  context.__testApi.resolveMatchUrl(
    { status: "finished", liveUrl: "https://lpl.qq.com/replay/1" },
    "bilibili"
  ),
  "https://lpl.qq.com/replay/1"
);

context.__testApi.applyUserSettings({
  refreshProfile: "battery",
  cacheHours: 24,
});
assert.equal(
  context.__testApi.nextRefreshDate([live], now).getTime() - now.getTime(),
  5 * 60 * 1000
);

console.log("official schedule parser: ok");
