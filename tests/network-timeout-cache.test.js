const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const designSystem = require("../LPL-Design-System");
const source = fs
  .readFileSync(path.join(root, "LPL-Schedule.js"), "utf8")
  .replace(
    "await main();",
    "globalThis.__networkTestApi = { loadSchedule, CACHE_FILE, inspectCache, buildDiagnosticText };"
  );
const cachePath = "/documents/lpl-schedule-cache.json";
const DAY_MS = 24 * 60 * 60 * 1000;
const FIXED_NOW = new Date("2026-08-10T08:00:00Z");
const RuntimeDate = class extends Date {
  constructor(...args) {
    super(...(args.length ? args : [FIXED_NOW]));
  }
  static now() {
    return FIXED_NOW.getTime();
  }
};

function beijingDateOffset(days) {
  const shifted = new Date(
    FIXED_NOW.getTime() + 8 * 60 * 60 * 1000 + days * DAY_MS
  );
  return [
    shifted.getUTCFullYear(),
    String(shifted.getUTCMonth() + 1).padStart(2, "0"),
    String(shifted.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

const fixtureDate = beijingDateOffset(1);
const tournamentStartDate = beijingDateOffset(-30);
const tournamentEndDate = beijingDateOffset(30);

function match(id = "cache-match") {
  return {
    id,
    gameId: id,
    tournamentId: "lpl-2026-split3-playoffs",
    startTime: `${fixtureDate} 18:00:00`,
    left: "BLG",
    right: "TES",
    leftLogo: "",
    rightLogo: "",
    status: "upcoming",
    matchType: "BO5",
    stage: "季后赛",
    leftScore: null,
    rightScore: null,
    liveUrl: "https://lpl.qq.com/",
    detailUrl: "https://lpl.qq.com/",
  };
}

function cache(ageHours = 0, id = "cache-match") {
  return {
    updatedAt: new Date(
      FIXED_NOW.getTime() - ageHours * 60 * 60 * 1000
    ).toISOString(),
    source: "cached source",
    tournament: {
      id: "lpl-2026-split3-playoffs",
      name: "2026 LPL 第三赛段",
      shortName: "LPL PLAYOFFS",
      season: "2026",
      region: "CN",
      stage: "季后赛",
      startDate: tournamentStartDate,
      endDate: tournamentEndDate,
      dataSource: "lpl",
    },
    selectedDate: fixtureDate,
    selectionReason: "CACHE_SEED",
    matches: [match(id)],
  };
}

function emptyCache(ageHours = 0) {
  return {
    ...cache(ageHours),
    source: "Installer-Dev 工作区种子",
    nextTournament: null,
    businessState: "TOURNAMENT_FINISHED",
    selectedDate: null,
    matches: [],
    tournament: {
      ...cache(ageHours).tournament,
      endDate: beijingDateOffset(-1),
    },
  };
}

function remoteActive({ ageHours = 0, season = "2026" } = {}) {
  const updatedAt = new Date(
    FIXED_NOW.getTime() - ageHours * 60 * 60 * 1000
  ).toISOString();
  return {
    generatedAt: updatedAt,
    sourceUpdatedAt: updatedAt,
    tournament: {
      id: "lpl-2026-split3-playoffs",
      name: "2026 LPL 第三赛段",
      shortName: "LPL PLAYOFFS",
      season,
      region: "CN",
      stage: "季后赛",
      startDate: tournamentStartDate,
      endDate: tournamentEndDate,
      dataSource: "manual",
    },
    selectedDate: fixtureDate,
    selectionReason: "SMART_TODAY_MATCHES",
    matches: [match("remote-match")],
  };
}

function remoteFinishedActive() {
  const active = remoteActive();
  active.businessState = "TOURNAMENT_FINISHED";
  active.selectedDate = null;
  active.selectionReason = "SMART_TOURNAMENT_FINISHED";
  active.matches = [];
  active.tournament.endDate = beijingDateOffset(-1);
  active.nextTournament = {
    ...active.tournament,
    id: "worlds-2026",
    name: "2026 英雄联盟全球总决赛",
    shortName: "WORLDS 2026",
    region: "international",
    stage: "瑞士轮",
    startDate: beijingDateOffset(10),
    endDate: beijingDateOffset(30),
  };
  return active;
}

function never() {
  return new Promise(() => {});
}

const officialPageText = [
  "2026 LPL 第三赛段官方赛程",
  "BLG",
  `${fixtureDate} 18:00`,
  "TES",
  "比赛时间以官方公布为准",
].join("\n");

function createRuntime({ cached, remote, official }) {
  const files = new Map();
  if (cached) files.set(cachePath, JSON.stringify(cached));
  const logs = [];
  let requestCount = 0;

  const fileManager = {
    documentsDirectory: () => "/documents",
    joinPath: (directory, name) => `${directory}/${name}`,
    fileExists: (file) => files.has(file),
    readString: (file) => files.get(file),
    writeString: (file, content) => files.set(file, content),
  };
  const context = {
    console: {
      log: (message) => logs.push(String(message)),
      warn: console.warn,
      error: console.error,
    },
    Set,
    Date: RuntimeDate,
    config: { runsInWidget: true, widgetFamily: "medium" },
    importModule: () => designSystem,
    FileManager: { local: () => fileManager },
    Request: class {
      constructor(url) {
        this.url = url;
        requestCount += 1;
      }

      loadJSON() {
        if (remote === "never") return never();
        if (remote === "fail") return Promise.reject(new Error("offline"));
        if (remote === "http") return Promise.reject(new Error("HTTP 503"));
        if (remote === "stale") {
          return Promise.resolve(remoteActive({ ageHours: 72 }));
        }
        if (remote === "wrong-season") {
          return Promise.resolve(remoteActive({ season: "2025" }));
        }
        if (remote === "finished")
          return Promise.resolve(remoteFinishedActive());
        return Promise.resolve(remoteActive());
      }
    },
    WebView: class {
      loadURL() {
        if (official === "never") return never();
        if (official === "success") return Promise.resolve();
        return Promise.reject(new Error("official offline"));
      }

      evaluateJavaScript() {
        return Promise.resolve(officialPageText);
      }
    },
    Timer: {
      schedule(milliseconds, _repeats, callback) {
        const handle = setTimeout(callback, milliseconds / 1000);
        return { invalidate: () => clearTimeout(handle) };
      },
    },
  };

  vm.runInNewContext(source, context, {
    filename: path.join(root, "LPL-Schedule.js"),
  });
  return {
    api: context.__networkTestApi,
    files,
    logs,
    requestCount: () => requestCount,
  };
}

async function expectCache(runtime) {
  const startedAt = Date.now();
  const result = await runtime.api.loadSchedule();
  assert.equal(result.source, "本地缓存");
  assert.equal(result.matches[0].id, "cache-match");
  assert.equal(
    Date.now() - startedAt < 100,
    true,
    "must stay within mock budget"
  );
  return JSON.parse(
    runtime.files.get("/documents/lpl-schedule-data-diagnostics.json")
  );
}

async function main() {
  const finishedOnline = createRuntime({
    remote: "finished",
    official: "fail",
  });
  const finishedResult = await finishedOnline.api.loadSchedule();
  assert.equal(finishedResult.source, "GitHub Active");
  assert.equal(finishedResult.businessState, "TOURNAMENT_FINISHED");
  assert.equal(finishedResult.matches.length, 0);
  assert.equal(finishedOnline.api.inspectCache().status, "EMPTY_VALID");
  assert.equal(finishedOnline.requestCount(), 1);

  const empty = createRuntime({
    cached: emptyCache(),
    remote: "fail",
    official: "fail",
  });
  assert.equal(empty.api.inspectCache().status, "EMPTY_VALID");
  assert.match(
    empty.api.buildDiagnosticText(null, empty.api.inspectCache()),
    /缓存状态：EMPTY_VALID/
  );
  const emptyResult = await empty.api.loadSchedule();
  assert.equal(emptyResult.businessState, "TOURNAMENT_FINISHED");
  assert.equal(emptyResult.matches.length, 0);

  const missing = createRuntime({ remote: "fail", official: "fail" });
  assert.equal(missing.api.inspectCache().status, "MISSING");

  const expiredState = createRuntime({
    cached: emptyCache(13),
    remote: "fail",
    official: "fail",
  });
  assert.equal(expiredState.api.inspectCache().status, "EXPIRED");

  const invalid = createRuntime({
    cached: { updatedAt: new Date().toISOString(), matches: [] },
    remote: "fail",
    official: "fail",
  });
  assert.equal(invalid.api.inspectCache().status, "INVALID");

  const timeoutToOfficial = createRuntime({
    cached: cache(),
    remote: "never",
    official: "success",
  });
  const officialResult = await timeoutToOfficial.api.loadSchedule();
  assert.equal(officialResult.source, "官方页面");
  assert.equal(officialResult.matches.length, 1);
  const officialDiagnostics = JSON.parse(
    timeoutToOfficial.files.get("/documents/lpl-schedule-data-diagnostics.json")
  );
  assert.deepEqual(
    officialDiagnostics.attempts.map(({ source, status }) => [source, status]),
    [
      ["GitHub Active", "failure"],
      ["官方页面", "success"],
    ]
  );

  const remoteNever = createRuntime({
    cached: cache(),
    remote: "never",
    official: "fail",
  });
  await expectCache(remoteNever);
  assert.equal(remoteNever.requestCount(), 1);
  assert.equal(
    remoteNever.logs.some((line) =>
      /remote failed: remote active timeout \(3s\)/.test(line)
    ),
    true
  );

  const httpError = createRuntime({
    cached: cache(),
    remote: "http",
    official: "fail",
  });
  await expectCache(httpError);
  assert.equal(
    httpError.logs.some((line) => line.includes("remote failed: HTTP 503")),
    true
  );
  assert.equal(
    httpError.logs.some((line) =>
      line.includes("remote failed/timeout: HTTP 503")
    ),
    false
  );

  const officialNever = createRuntime({
    cached: cache(),
    remote: "fail",
    official: "never",
  });
  await expectCache(officialNever);

  const allFail = createRuntime({
    cached: cache(),
    remote: "fail",
    official: "fail",
  });
  const diagnostics = await expectCache(allFail);
  assert.deepEqual(
    diagnostics.attempts.map(({ status }) => status),
    ["failure", "failure", "success"]
  );
  assert.match(diagnostics.attempts[0].message, /offline|timeout/);
  assert.match(diagnostics.attempts[1].message, /official offline|timeout/);
  assert.match(diagnostics.attempts[2].message, /cache accepted/);
  assert.equal(
    [
      "remote failed:",
      "official failed:",
      "cache accepted",
      "final source: 本地缓存",
    ].every((entry) => allFail.logs.some((line) => line.includes(entry))),
    true
  );

  const expired = createRuntime({
    cached: cache(13),
    remote: "fail",
    official: "fail",
  });
  await assert.rejects(expired.api.loadSchedule(), /本地缓存：EXPIRED/);

  const recovered = createRuntime({
    cached: cache(),
    remote: "success",
    official: "fail",
  });
  const recoveredResult = await recovered.api.loadSchedule();
  assert.equal(recoveredResult.source, "GitHub Active");
  assert.equal(recoveredResult.matches[0].id, "remote-match");
  const refreshedCache = JSON.parse(recovered.files.get(cachePath));
  assert.equal(refreshedCache.source, "GitHub Active");
  assert.equal(refreshedCache.matches[0].id, "remote-match");

  const staleRemote = createRuntime({
    cached: cache(),
    remote: "stale",
    official: "fail",
  });
  const staleDiagnostics = await expectCache(staleRemote);
  assert.match(staleDiagnostics.attempts[0].message, /超过 48 小时/);

  const wrongSeasonRemote = createRuntime({
    cached: cache(),
    remote: "wrong-season",
    official: "fail",
  });
  const wrongSeasonDiagnostics = await expectCache(wrongSeasonRemote);
  assert.match(wrongSeasonDiagnostics.attempts[0].message, /赛季不匹配/);

  assert.equal(recovered.api.CACHE_FILE, "lpl-schedule-cache.json");
  assert.notEqual(recovered.api.CACHE_FILE, "lpl-schedule-dev-cache.json");

  console.log("network timeout cache: ok");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
