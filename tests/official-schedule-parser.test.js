const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const scriptPath = path.join(__dirname, "..", "LPL-Schedule.js");
const source = fs
  .readFileSync(scriptPath, "utf8")
  .replace(
    "await main();",
    `globalThis.__testApi = {
      countdownText,
      findNextMatchDay,
      applyUserSettings,
      matchRightValue,
      matchSubtitle,
      matchValueMetrics,
      nextRefreshDate,
      normalizeUserSettings,
      parseOfficialSchedule,
      resolveMatchUrl,
      sortMatchesByTime,
    };`
  );
const context = {
  console,
  Set,
};

vm.runInNewContext(source, context, { filename: scriptPath });

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
assert.equal(context.__testApi.matchRightValue(live, now), "1-0");
assert.equal(
  context.__testApi.matchSubtitle(
    { ...live, leftScore: 0, rightScore: 0 },
    now
  ),
  "直播中 · 比分待更新 · BO3"
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
const nextDay = JSON.parse(
  JSON.stringify(
    context.__testApi.findNextMatchDay([finished, tomorrow], now)
  )
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
  JSON.parse(
    JSON.stringify(context.__testApi.matchValueMetrics("medium"))
  ),
  { fontSize: 26, minimumScaleFactor: 0.6 }
);
assert.deepEqual(
  JSON.parse(
    JSON.stringify(context.__testApi.matchValueMetrics("large"))
  ),
  { fontSize: 20, minimumScaleFactor: 0.65 }
);
assert.deepEqual(
  JSON.parse(
    JSON.stringify(context.__testApi.matchValueMetrics("small"))
  ),
  { fontSize: 26, minimumScaleFactor: 0.6 }
);

assert.deepEqual(
  JSON.parse(
    JSON.stringify(
      context.__testApi.normalizeUserSettings({
        dataMode: "REMOTE",
        mediumMatches: 99,
        largeMatches: 0,
        highlightedTeams: ["tt", "未知队伍", "TT", "blg"],
        livePlatform: "BILIBILI",
        cacheHours: 24,
        refreshProfile: "battery",
        ignored: true,
      })
    )
  ),
  {
    dataMode: "remote",
    mediumMatches: 3,
    largeMatches: 1,
    highlightedTeams: ["TT", "BLG"],
    livePlatform: "bilibili",
    cacheHours: 24,
    refreshProfile: "battery",
  }
);
assert.deepEqual(
  JSON.parse(
    JSON.stringify(context.__testApi.normalizeUserSettings(null))
  ),
  {
    dataMode: "auto",
    mediumMatches: 2,
    largeMatches: 5,
    highlightedTeams: ["BLG", "AL", "TES", "WBG"],
    livePlatform: "official",
    cacheHours: 12,
    refreshProfile: "balanced",
  }
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
