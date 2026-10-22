const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const source = fs
  .readFileSync(path.join(root, "LPL-Schedule.js"), "utf8")
  .replace(
    "await main();",
    "globalThis.__test = { loadSchedule, selectScheduleResult, worldsDisplayResult, normalizeActivePayload, renderError, inWorlds2026Window, worldsRouteError };"
  );
const designSystem = require("../LPL-Design-System");
const now = new Date("2026-10-22T08:00:00Z");
const officialUrl = "https://lolesports.com/en-US/leagues/worlds";
const match = (id, left, right, leftId, rightId) => ({
  id,
  tournamentId: "worlds-2026",
  startTime: "2026-10-23 02:00:00",
  left,
  right,
  leftScore: null,
  rightScore: null,
  status: "upcoming",
  matchType: "BO5",
  stage: "Knockout",
  detailUrl: officialUrl,
  participants: {
    version: 1,
    source: {
      provider: "riot-lolesports",
      url: officialUrl,
      leagueId: "98767975604431411",
      tournamentId: "115660540725177488",
      matchId: id,
    },
    left: { kind: leftId === "0" ? "placeholder" : "team", id: leftId },
    right: { kind: rightId === "0" ? "placeholder" : "team", id: rightId },
  },
});
const active = {
  generatedAt: now.toISOString(),
  sourceUpdatedAt: now.toISOString(),
  sourceUrl: officialUrl,
  classification: "PARTIAL_OBSERVED",
  sourceAuthorization: "VERIFIED",
  coverageVerified: true,
  coverageStart: "2026-10-15",
  coverageEnd: "2026-11-14",
  tournament: {
    id: "worlds-2026",
    name: "Worlds 2026",
    shortName: "WORLDS 2026",
    season: "2026",
    region: "INTL",
    stage: "Global Finals",
    startDate: "2026-10-15",
    endDate: "2026-11-14",
    dataSource: "manual",
  },
  businessState: "MATCHES",
  selectedDate: "2026-10-23",
  matches: [
    match("12345678901", "TBD", "TBD", "0", "0"),
    match("12345678902", "TBD", "TES", "0", "23456789012"),
  ],
};

function makeContext(payload, cacheText = null) {
  const writes = new Map();
  if (cacheText !== null)
    writes.set("/documents/lpl-schedule-cache.json", cacheText);
  const requests = [];
  const RuntimeDate = class extends Date {
    constructor(...args) {
      super(args.length >= 2 ? Date.UTC(...args) : args.length ? args[0] : now);
    }
    static now() {
      return now.getTime();
    }
  };
  const fm = {
    documentsDirectory: () => "/documents",
    joinPath: (directory, name) => `${directory}/${name}`,
    fileExists: (file) => writes.has(file),
    readString: (file) => writes.get(file),
    writeString: (file, content) => writes.set(file, content),
  };
  const context = {
    console,
    Set,
    Date: RuntimeDate,
    importModule: () => designSystem,
    FileManager: { local: () => fm },
    Request: class {
      constructor(url) {
        requests.push(url);
      }
      async loadJSON() {
        if (payload instanceof Error) throw payload;
        return payload;
      }
    },
    WebView: class {
      constructor() {
        throw new Error("LPL fallback must not run during Worlds");
      }
    },
    Timer: {
      schedule(_milliseconds, _repeats, callback) {
        const handle = setTimeout(callback, 1000);
        return { invalidate: () => clearTimeout(handle) };
      },
    },
  };
  context.ListWidget = class {
    constructor() {
      this.texts = [];
    }
    setPadding() {}
    addSpacer() {}
    addText(value) {
      const item = { value };
      this.texts.push(item);
      return item;
    }
    addStack() {
      return {
        addStack: () => ({
          size: null,
          cornerRadius: null,
          backgroundColor: null,
        }),
        addText: (value) => this.addText(value),
        addSpacer() {},
        layoutHorizontally() {},
        centerAlignContent() {},
      };
    }
  };
  context.Font = {
    mediumSystemFont: () => ({}),
    boldSystemFont: () => ({}),
  };
  context.Color = class {};
  context.Size = class {};
  designSystem.applyCardBackground = () => {};
  vm.runInNewContext(source, context, { filename: "LPL-Schedule.js" });
  return { api: context.__test, writes, requests };
}

(async () => {
  const valid = makeContext(active);
  assert.equal(
    valid.api.inWorlds2026Window(new Date("2026-11-14T16:00:00Z")),
    true,
    "北京时间 11 月 15 日决赛应仍在 Worlds 窗口内"
  );
  const finalPayload = {
    ...active,
    coverageEnd: "2026-11-15",
    selectedDate: "2026-11-15",
    tournament: { ...active.tournament, endDate: "2026-11-15" },
    matches: [
      {
        ...match("12345678903", "TBD", "TBD", "0", "0"),
        startTime: "2026-11-15 03:00:00",
      },
    ],
  };
  const finalContext = makeContext(finalPayload);
  assert.equal(
    (await finalContext.api.loadSchedule()).matches[0].time,
    "03:00",
    "正式客户端应接受北京时间 11 月 15 日的决赛"
  );
  const data = await valid.api.loadSchedule();
  assert.equal(data.tournament.id, "worlds-2026");
  assert.equal(data.classification, "PARTIAL_OBSERVED");
  assert.equal(data.matches[0].left, "TBD");
  assert.equal(data.matches[0].right, "TBD");
  assert.equal(data.matches[1].left, "TBD");
  assert.equal(data.matches[1].right, "TES");
  assert.equal(
    data.matches[0].timestamp,
    Date.parse("2026-10-23T02:00:00+08:00")
  );
  assert.equal(data.matches[0].time, "02:00");
  assert.equal(valid.requests.length, 1);
  assert.equal(
    valid.api.selectScheduleResult(data, now).dateString,
    "2026-10-23"
  );
  const publishedActive = JSON.parse(
    fs.readFileSync(path.join(root, "data", "active.json"), "utf8")
  );
  const published = makeContext(publishedActive);
  await assert.rejects(published.api.loadSchedule(), /Worlds.*不可用/);
  assert.equal(published.requests.length, 1);
  const savedCache = valid.writes.get("/documents/lpl-schedule-cache.json");
  assert.ok(savedCache);
  const cached = makeContext(new Error("offline"), savedCache);
  assert.equal((await cached.api.loadSchedule()).source, "本地 Worlds 缓存");

  for (const changed of [
    { ...active, tournament: { ...active.tournament, id: "lpl-2026-split3" } },
    { ...active, classification: undefined },
    { ...active, sourceAuthorization: "NOT_VERIFIED" },
    { ...active, coverageVerified: false },
    {
      ...active,
      matches: [
        active.matches[0],
        { ...active.matches[1], participants: undefined },
      ],
    },
    { ...active, matches: [active.matches[0], active.matches[0]] },
    { ...active, matches: [{ ...active.matches[0], leftScore: -1 }] },
    { ...active, sourceUpdatedAt: "2026-10-19T00:00:00Z" },
  ]) {
    const invalid = makeContext(changed);
    await assert.rejects(invalid.api.loadSchedule(), /Worlds.*不可用/);
    assert.equal(invalid.requests.length, 1);
  }

  const offline = makeContext(new Error("offline"), "{broken-json");
  await assert.rejects(offline.api.loadSchedule(), /Worlds.*不可用/);
  assert.equal(offline.requests.length, 1);
  const unavailable = offline.api.renderError(new Error("offline"));
  assert.equal(unavailable.url, officialUrl);
  assert.equal(
    unavailable.texts.some((item) => item.value === "赛程暂不可用"),
    true
  );
  const expiredCache = JSON.parse(savedCache);
  expiredCache.updatedAt = "2026-10-20T00:00:00Z";
  const expired = makeContext(
    new Error("offline"),
    JSON.stringify(expiredCache)
  );
  await assert.rejects(expired.api.loadSchedule(), /Worlds.*不可用/);

  const display = valid.api.worldsDisplayResult(
    {
      tournament: active.tournament,
      matches: Array.from({ length: 8 }, (_, index) => ({
        id: String(index),
        status: index < 4 ? "finished" : "upcoming",
        matchType: "BO1",
        timestamp: new Date(`2026-10-23T0${index}:00:00Z`).getTime(),
      })),
    },
    "large",
    new Date("2026-10-23T04:00:00Z")
  );
  assert.equal(display.matches.length, 4);
  assert.deepEqual(
    Array.from(display.matches, (item) => item.id),
    ["4", "5", "6", "7"]
  );

  console.log("worlds production client: ok");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
