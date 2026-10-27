const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const designSystem = require("../LPL-Design-System");
const converter = require("../LPL-Cito-Worlds");
const personal = require("../LPL-Cito-Personal");

const root = path.join(__dirname, "..");
const source = fs
  .readFileSync(path.join(root, "LPL-Schedule.js"), "utf8")
  .replace(
    "await main();",
    "globalThis.__test = { loadSchedule, applyUserSettings, normalizeUserSettings, selectScheduleResult, personalCitoKey };"
  );
const start = new Date("2026-10-26T21:06:51.893Z");
const files = new Map();
const key = "synthetic-key";
const synthetic = {
  success: true,
  data: {
    leagueId: "lol-worlds",
    leagueName: "Worlds",
    total: 1,
    count: 1,
    limit: 100,
    offset: 0,
    hasMore: false,
    events: [
      {
        matchId: "lol-match-115660540726095057",
        startTime: "2026-10-26T21:00:00.000Z",
        state: "inProgress",
        type: "match",
        blockName: "Swiss",
        tournamentId: "lol-worlds_2026",
        leagueId: "lol-worlds",
        leagueName: "Worlds",
        teams: [
          { slug: "tl", name: "Team Liquid", code: "TLAW", score: 0 },
          { slug: "al", name: "Anyone's Legend", code: "AL", score: 0 },
        ],
        strategy: { type: "bestOf", count: 3 },
      },
    ],
  },
};
const pages = process.env.CITO_PRIVATE_PAGES_PATH
  ? JSON.parse(fs.readFileSync(process.env.CITO_PRIVATE_PAGES_PATH, "utf8"))
  : [synthetic];
let calls = 0;
const RuntimeDate = class extends Date {
  constructor(...args) {
    super(args.length ? args[0] : start);
  }
  static now() {
    return start.getTime();
  }
};
const fm = {
  documentsDirectory: () => "/local",
  joinPath: (directory, name) => `${directory}/${name}`,
  fileExists: (file) => files.has(file),
  readString: (file) => files.get(file),
  writeString: (file, value) => files.set(file, value),
  copy: (from, to) => files.set(to, files.get(from)),
  move: (from, to) => {
    files.set(to, files.get(from));
    files.delete(from);
  },
  remove: (file) => files.delete(file),
};
const context = {
  console,
  Date: RuntimeDate,
  Set,
  config: { runsInWidget: true, widgetFamily: "medium" },
  args: { widgetParameter: "" },
  importModule: (name) => {
    if (name === "LPL-Design-System") return designSystem;
    if (name === "LPL-Cito-Worlds") return converter;
    if (name === "LPL-Cito-Personal") return personal;
    throw new Error("unknown module");
  },
  FileManager: { local: () => fm },
  Keychain: {
    contains: (name) => name === "lpl-schedule-personal-cito-api-key",
    get: () => key,
  },
  Request: class {
    constructor(url) {
      assert.match(url, /^https:\/\/api\.citoapi\.com\//);
    }
    async loadJSON() {
      calls++;
      assert.equal(this.headers["x-api-key"], key);
      this.response = { statusCode: 200 };
      return pages[calls - 1];
    }
  },
  Timer: { schedule: () => ({ invalidate() {} }) },
};
vm.runInNewContext(source, context, { filename: "LPL-Schedule.js" });

(async () => {
  assert.equal(context.__test.personalCitoKey(), key);
  context.__test.applyUserSettings(
    context.__test.normalizeUserSettings({ personalCito: true })
  );
  const loaded = await context.__test.loadSchedule();
  assert.equal(loaded.tournament.id, "worlds-2026");
  if (process.env.CITO_PRIVATE_PAGES_PATH) {
    assert.ok(loaded.selectedDate >= "2026-10-27");
  } else {
    assert.equal(loaded.selectedDate, "2026-10-27");
  }
  assert.equal(loaded.classification, "PARTIAL_OBSERVED");
  assert.equal(loaded.sourceAuthorization, "NOT_VERIFIED");
  assert.equal(loaded.coverageVerified, false);
  assert.ok(loaded.matches.length >= 1);
  assert.equal(
    context.__test.selectScheduleResult(loaded).tournament.shortName,
    "WORLDS · 部分"
  );
  assert.equal(calls, 1, "personal mode must not request public Active");
  assert.ok(files.has(personal.personalPaths(fm).current));
  const cached = await context.__test.loadSchedule();
  assert.equal(cached.matches.length, loaded.matches.length);
  assert.equal(calls, 1, "fresh local cache should avoid another request");
  console.log(
    `worlds personal formal client: ${loaded.observedMatchCount} observed, ${loaded.matches.length} selected; desktop simulation only`
  );
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
