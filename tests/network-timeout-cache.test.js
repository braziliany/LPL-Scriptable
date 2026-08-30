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
    "globalThis.__networkTestApi = { loadSchedule, CACHE_FILE };"
  );
const cachePath = "/documents/lpl-schedule-cache.json";

function match(id = "cache-match") {
  return {
    id,
    gameId: id,
    tournamentId: "lpl-2026-split3-playoffs",
    startTime: "2026-09-01 18:00:00",
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
    updatedAt: new Date(Date.now() - ageHours * 60 * 60 * 1000).toISOString(),
    source: "cached source",
    tournament: {
      id: "lpl-2026-split3-playoffs",
      name: "2026 LPL 第三赛段",
      shortName: "LPL PLAYOFFS",
      season: "2026",
      region: "CN",
      stage: "季后赛",
      startDate: "2026-08-28",
      endDate: "2026-09-13",
      dataSource: "lpl",
    },
    selectedDate: "2026-09-01",
    selectionReason: "CACHE_SEED",
    matches: [match(id)],
  };
}

function remoteActive() {
  const updatedAt = new Date().toISOString();
  return {
    generatedAt: updatedAt,
    sourceUpdatedAt: updatedAt,
    tournament: {
      id: "lpl-2026-split3-playoffs",
      name: "2026 LPL 第三赛段",
      shortName: "LPL PLAYOFFS",
      season: "2026",
      region: "CN",
      stage: "季后赛",
      startDate: "2026-08-28",
      endDate: "2026-12-31",
      dataSource: "manual",
    },
    selectedDate: "2026-09-01",
    selectionReason: "SMART_TODAY_MATCHES",
    matches: [match("remote-match")],
  };
}

function never() {
  return new Promise(() => {});
}

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
        return Promise.resolve(remoteActive());
      }
    },
    WebView: class {
      loadURL() {
        if (official === "never") return never();
        return Promise.reject(new Error("official offline"));
      }
    },
    Timer: {
      schedule(seconds, _repeats, callback) {
        const handle = setTimeout(callback, seconds);
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
  const remoteNever = createRuntime({
    cached: cache(),
    remote: "never",
    official: "fail",
  });
  await expectCache(remoteNever);
  assert.equal(remoteNever.requestCount(), 1);

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
      "remote failed/timeout",
      "official failed/timeout",
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
  await assert.rejects(expired.api.loadSchedule(), /本地缓存：已过期/);

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

  assert.equal(recovered.api.CACHE_FILE, "lpl-schedule-cache.json");
  assert.notEqual(recovered.api.CACHE_FILE, "lpl-schedule-dev-cache.json");

  console.log("network timeout cache: ok");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
