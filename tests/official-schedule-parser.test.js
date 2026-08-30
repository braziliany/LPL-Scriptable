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
      effectiveMatchStatus,
      addFooter,
      addHeader,
      buildDiagnosticText,
      findNextMatchDay,
      inferMatchGroup,
      isCurrentSeasonStage,
      isWithinFinishedScoreHold,
      applyUserSettings,
      matchRightValue,
      matchStageLabel,
      matchSubtitle,
      matchVisualStyle,
      matchWinner,
      matchValueMetrics,
      mediumLayoutProfile,
      nextRefreshDate,
      normalizeActivePayload,
      normalizeRemoteSchedulePayload,
      normalizeUserSettings,
      logoCacheFileName,
      teamLogoScale,
      parseOfficialSchedule,
      parseOfficialApiState,
      mergeOfficialState,
      resolveMatchUrl,
      resolveThemeMode,
      remoteScheduleFreshnessError,
      shouldUseCompactMedium,
      shouldOpenSettings,
      singleMatchPreviewResult,
      selectScheduleResult,
      sortMatchesByTime,
      tournamentFooterText,
      tournamentTitle,
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

function renderingStack(texts) {
  return {
    addStack() {
      return renderingStack(texts);
    },
    addSpacer() {},
    addText(value) {
      texts.push(value);
      return {};
    },
    centerAlignContent() {},
    layoutHorizontally() {},
  };
}

context.Color = class Color {};
context.Font = { mediumSystemFont: () => ({}) };
context.Size = class Size {};
context.URLScheme = { forRunningScript: () => "scriptable:///run" };
context.config = { widgetFamily: "medium" };

for (const [shortName, name, stage] of [
  ["LPL PLAYOFFS", "2026 LPL 第三赛段", "季后赛"],
  ["WORLDS 2026", "2026 英雄联盟全球总决赛", "全球总决赛"],
]) {
  const texts = [];
  const tournament = {
    id: shortName.toLowerCase().replaceAll(" ", "-"),
    shortName,
    name,
    season: "2026",
    region: "INTL",
    stage,
  };
  const result = {
    dateString: "2026-10-20",
    offset: 0,
    tournament,
  };
  context.__testApi.addHeader(renderingStack(texts), result);
  context.__testApi.addFooter(renderingStack(texts), "GitHub Active", result);
  assert.equal(texts[0], shortName);
  assert.equal(texts.at(-1), `${name} · ${stage} · GitHub Active`);
}

assert.equal(
  context.__testApi.logoCacheFileName("BLG"),
  "lpl-team-logo-BLG.png"
);
assert.equal(context.__testApi.teamLogoScale("TES"), 1.51);
assert.equal(context.__testApi.teamLogoScale("unknown"), 1.35);
assert.equal(context.__testApi.inferMatchGroup("TT", "TES"), "登峰组");
assert.equal(context.__testApi.inferMatchGroup("IG", "LNG"), "涅槃组");
assert.equal(context.__testApi.inferMatchGroup("TT", "LNG"), "");
assert.equal(context.__testApi.isCurrentSeasonStage("第三赛段组内赛"), true);
assert.equal(context.__testApi.isCurrentSeasonStage("2026赛季季后赛"), true);
assert.equal(context.__testApi.isCurrentSeasonStage("资格赛"), true);
assert.equal(context.__testApi.isCurrentSeasonStage("第二赛段组内赛"), false);
assert.equal(
  context.__testApi.matchStageLabel({
    stage: "第三赛段骑士之路",
    left: "TT",
    right: "WBG",
  }),
  "骑士之路"
);
assert.equal(
  context.__testApi.matchStageLabel({
    stage: "第三赛段淘汰赛",
    phase: "败者组决赛",
  }),
  "败者组决赛"
);
assert.equal(
  context.__testApi.matchStageLabel({
    stage: "第三赛段淘汰赛",
    phase: "第一轮",
  }),
  "淘汰赛"
);

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

const freshnessNow = new Date(2026, 7, 27, 12, 0);
const freshRemotePayload = {
  season: "2026 LPL 第三赛段",
  updatedAt: "2026-08-27T10:00:00+08:00",
  matches: [
    {
      id: "13492",
      startTime: "2026-08-28 14:00:00",
      left: "EDG",
      right: "NIP",
      status: "upcoming",
      matchType: "BO5",
      stage: "第三赛段骑士之路",
    },
  ],
};

const activeTournament = {
  id: "worlds-2026",
  name: "2026 英雄联盟全球总决赛",
  shortName: "WORLDS 2026",
  season: "2026",
  region: "INTL",
  stage: "全球总决赛",
  startDate: "2026-10-15",
  endDate: "2026-11-14",
  dataSource: "manual",
};
const activePayload = {
  generatedAt: "2026-10-20T02:00:00.000Z",
  sourceUpdatedAt: "2026-10-20T01:00:00.000Z",
  tournament: activeTournament,
  selectedDate: "2026-10-20",
  selectionReason: "SMART_TODAY_MATCHES",
  matches: [
    {
      tournamentId: "worlds-2026",
      startTime: "2026-10-20 17:00:00",
      left: "AAA",
      right: "BBB",
      status: "upcoming",
      matchType: "BO3",
      stage: "瑞士轮",
      leftScore: null,
      rightScore: null,
      liveUrl: "",
      detailUrl: "",
    },
  ],
};
const normalizedActive = context.__testApi.normalizeActivePayload(
  activePayload,
  new Date("2026-10-20T03:00:00.000Z")
);
assert.equal(normalizedActive.tournament.shortName, "WORLDS 2026");
assert.equal(normalizedActive.matches[0].tournamentId, "worlds-2026");
assert.equal(
  context.__testApi.tournamentTitle(activeTournament),
  "WORLDS 2026"
);
assert.equal(
  context.__testApi.tournamentFooterText(activeTournament),
  "2026 英雄联盟全球总决赛 · 全球总决赛"
);
assert.equal(
  context.__testApi.tournamentTitle({
    ...activeTournament,
    id: "ewc-2026",
    shortName: "EWC 2026",
  }),
  "EWC 2026"
);
assert.throws(
  () =>
    context.__testApi.normalizeActivePayload(
      { ...activePayload, generatedAt: "2026-10-17T02:00:00.000Z" },
      new Date("2026-10-20T03:00:00.000Z")
    ),
  /更新时间已超过 48 小时/
);
assert.throws(
  () =>
    context.__testApi.normalizeActivePayload(
      { ...activePayload, sourceUpdatedAt: "2026-10-17T02:00:00.000Z" },
      new Date("2026-10-20T03:00:00.000Z")
    ),
  /源数据更新时间已超过 48 小时/
);
assert.throws(
  () =>
    context.__testApi.normalizeActivePayload(
      {
        ...activePayload,
        tournament: { ...activeTournament, season: "2025" },
      },
      new Date("2026-10-20T03:00:00.000Z")
    ),
  /赛季不匹配/
);
assert.throws(
  () =>
    context.__testApi.normalizeActivePayload(
      {
        ...activePayload,
        tournament: { ...activeTournament, endDate: "2026-10-19" },
      },
      new Date("2026-10-20T03:00:00.000Z")
    ),
  /超出赛事日期范围|赛事已经结束/
);
assert.throws(
  () =>
    context.__testApi.normalizeActivePayload(
      {
        ...activePayload,
        matches: [
          { ...activePayload.matches[0], tournamentId: "other-tournament" },
        ],
      },
      new Date("2026-10-20T03:00:00.000Z")
    ),
  /tournamentId/
);

assert.equal(
  context.__testApi.normalizeRemoteSchedulePayload(
    freshRemotePayload,
    freshnessNow
  ).length,
  1
);
assert.throws(
  () =>
    context.__testApi.normalizeRemoteSchedulePayload(
      { ...freshRemotePayload, season: "2026 LPL 第二赛段" },
      freshnessNow
    ),
  /赛季不匹配/
);
assert.throws(
  () =>
    context.__testApi.normalizeRemoteSchedulePayload(
      { ...freshRemotePayload, updatedAt: "invalid" },
      freshnessNow
    ),
  /更新时间无效/
);
assert.throws(
  () =>
    context.__testApi.normalizeRemoteSchedulePayload(
      { ...freshRemotePayload, updatedAt: "2026-08-29T13:00:00+08:00" },
      freshnessNow
    ),
  /明显晚于设备时间/
);
assert.throws(
  () =>
    context.__testApi.normalizeRemoteSchedulePayload(
      { ...freshRemotePayload, updatedAt: "2026-08-25T11:00:00+08:00" },
      freshnessNow
    ),
  /更新时间已超过 48 小时/
);
assert.throws(
  () =>
    context.__testApi.normalizeRemoteSchedulePayload(
      {
        ...freshRemotePayload,
        matches: [
          {
            ...freshRemotePayload.matches[0],
            startTime: "2026-08-26 14:00:00",
          },
        ],
      },
      freshnessNow
    ),
  /没有今天或未来的赛程/
);
assert.equal(
  context.__testApi.remoteScheduleFreshnessError(
    freshRemotePayload,
    [
      {
        timestamp: new Date(2026, 7, 27, 10, 0).getTime(),
      },
    ],
    freshnessNow
  ),
  null
);

assert.equal(context.__testApi.countdownText(upcoming, now), "还有30分钟");
assert.equal(
  context.__testApi.countdownText(
    { ...upcoming, timestamp: now.getTime() },
    now
  ),
  "即将开始"
);
const delayedUpcoming = {
  ...upcoming,
  id: "13381",
  timestamp: now.getTime() - 11 * 60 * 1000,
};
assert.equal(
  context.__testApi.effectiveMatchStatus(delayedUpcoming, now),
  "live"
);
assert.equal(context.__testApi.countdownText(delayedUpcoming, now), null);
assert.equal(context.__testApi.matchRightValue(delayedUpcoming, now), "进行中");
assert.equal(
  context.__testApi.matchSubtitle(delayedUpcoming, now),
  "登峰组 · 进行中 · 状态待更新 · BO3"
);
assert.equal(
  context.__testApi.matchVisualStyle(delayedUpcoming, 0, now).accent,
  "#FF4D67"
);
assert.equal(context.__testApi.matchRightValue(upcoming, now), "还有30分钟");
assert.equal(
  context.__testApi.matchSubtitle(upcoming, now),
  "登峰组 · 还有30分钟 · BO3"
);
assert.equal(
  context.__testApi.matchSubtitle(
    {
      ...upcoming,
      timestamp: new Date(2026, 6, 26, 19, 0).getTime(),
    },
    now
  ),
  "登峰组 · 未开始 · BO3"
);
assert.equal(
  context.__testApi.matchSubtitle(
    {
      ...upcoming,
      stage: "第三赛段骑士之路",
      matchType: "BO5",
    },
    now
  ),
  "骑士之路 · 还有30分钟 · BO5"
);
assert.equal(context.__testApi.matchRightValue(live, now), "1-0");
assert.equal(
  context.__testApi.matchSubtitle(
    { ...live, leftScore: 0, rightScore: 0 },
    now
  ),
  "登峰组 · 直播中 · 比分待更新 · BO3"
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
assert.equal(
  context.__testApi.nextRefreshDate([delayedUpcoming], now).getTime() -
    now.getTime(),
  3 * 60 * 1000
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
    schemaVersion: 2,
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
    schemaVersion: 2,
    dataMode: "auto",
    highlightedTeams: ["BLG", "AL", "TES", "WBG"],
    livePlatform: "bilibili",
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
    tournament: activeTournament,
    selectedDate: "2026-10-20",
    selectionReason: "SMART_TODAY_MATCHES",
    matches: [upcoming, live],
  },
  "medium",
  new Date("2026-07-30T10:09:00+08:00")
);
assert.match(diagnosticText, /组件版本：3\.1\.0/);
assert.match(diagnosticText, /设计系统：3\.1\.0/);
assert.match(diagnosticText, /设置结构：v2/);
assert.match(diagnosticText, /当前赛事：2026 英雄联盟全球总决赛/);
assert.match(diagnosticText, /赛事短名：WORLDS 2026/);
assert.match(diagnosticText, /选择原因：SMART_TODAY_MATCHES/);
assert.match(diagnosticText, /运行环境：中号组件/);
assert.match(diagnosticText, /缓存状态：有效（9 分钟前）/);
assert.match(diagnosticText, /缓存比赛：2 场/);
const fallbackDiagnosticText = context.__testApi.buildDiagnosticText(
  null,
  null,
  "app",
  new Date("2026-07-30T10:09:00+08:00"),
  {
    updatedAt: "2026-07-30T10:08:00+08:00",
    selectedSource: "本地缓存",
    attempts: [
      {
        source: "GitHub",
        status: "failure",
        message: "HTTP 503",
      },
      {
        source: "官方页面",
        status: "failure",
        message: "解析失败",
      },
      {
        source: "本地缓存",
        status: "success",
        message: "有效",
      },
    ],
  }
);
assert.match(fallbackDiagnosticText, /最近来源：本地缓存/);
assert.match(
  fallbackDiagnosticText,
  /GitHub=失败（HTTP 503） → 官方页面=失败（解析失败） → 本地缓存=成功（有效）/
);
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
assert.deepEqual(
  JSON.parse(
    JSON.stringify(
      context.__testApi.mediumLayoutProfile([finished, live, upcoming])
    )
  ),
  {
    dense: true,
    compact: true,
    padding: [8, 16, 7, 16],
    headerSpacer: 4,
    rowSpacer: 3,
  }
);
const singlePreview = JSON.parse(
  JSON.stringify(
    context.__testApi.singleMatchPreviewResult({
      dateString: "2026-08-09",
      offset: 0,
      matches: [upcoming, live, finished],
    })
  )
);
assert.equal(singlePreview.matches.length, 1);
assert.equal(singlePreview.matches[0].left, "TT");
assert.equal(singlePreview.dateString, "2026-08-09");
const routedResult = context.__testApi.selectScheduleResult(
  {
    ...normalizedActive,
    source: "GitHub Active",
  },
  new Date("2026-10-20T03:00:00.000Z")
);
assert.equal(routedResult.dateString, "2026-10-20");
assert.equal(routedResult.tournament.shortName, "WORLDS 2026");
assert.throws(
  () => context.__testApi.singleMatchPreviewResult({ matches: [] }),
  /没有可用于预览的比赛/
);
assert.equal(context.__testApi.shouldOpenSettings(false, ""), true);
assert.equal(context.__testApi.shouldOpenSettings(false, "settings"), true);
assert.equal(context.__testApi.shouldOpenSettings(false, "medium"), false);
assert.equal(context.__testApi.shouldOpenSettings(true, "settings"), false);
assert.deepEqual(
  JSON.parse(
    JSON.stringify(context.__testApi.mediumLayoutProfile([live, upcoming]))
  ),
  {
    dense: false,
    compact: false,
    padding: [14, 16, 12, 16],
    headerSpacer: 12,
    rowSpacer: 16,
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
  "https://live.bilibili.com/6"
);
assert.equal(
  context.__testApi.resolveMatchUrl(
    { status: "finished", liveUrl: "https://lpl.qq.com/replay/1" },
    "official"
  ),
  "https://lpl.qq.com/replay/1"
);
assert.equal(
  context.__testApi.resolveMatchUrl(
    {
      ...live,
      liveUrl: "https://example.com/live",
      detailUrl: "https://example.com/detail",
    },
    "official",
    now
  ),
  "https://example.com/live"
);
assert.equal(
  context.__testApi.resolveMatchUrl(delayedUpcoming, "bilibili", now),
  "https://live.bilibili.com/6"
);

const officialStates = context.__testApi.parseOfficialApiState({
  status: "0",
  msg: [
    {
      bMatchId: "13381",
      GameId: "237",
      MatchDate: "2026-07-30 15:00:00",
      GameName: "2026职业联赛",
      GameTypeName: "第三赛段组内赛",
      MatchStatus: "2",
      ScoreA: "1",
      ScoreB: "0",
    },
    {
      bMatchId: "other",
      MatchDate: "2026-07-30 15:00:00",
      GameName: "其他赛事",
      GameTypeName: "第三赛段",
      MatchStatus: "2",
    },
  ],
});
assert.equal(officialStates.length, 1);
assert.equal(officialStates[0].status, "live");
assert.equal(officialStates[0].leftScore, 1);
const mergedState = context.__testApi.mergeOfficialState(
  [delayedUpcoming],
  officialStates,
  now
)[0];
assert.equal(mergedState.status, "live");
assert.equal(mergedState.leftScore, 1);
assert.match(mergedState.liveUrl, /live\.html\?bgid=237&bmid=13381/);

context.__testApi.applyUserSettings({
  refreshProfile: "battery",
  cacheHours: 24,
});
assert.equal(
  context.__testApi.nextRefreshDate([live], now).getTime() - now.getTime(),
  5 * 60 * 1000
);

console.log("official schedule parser: ok");
