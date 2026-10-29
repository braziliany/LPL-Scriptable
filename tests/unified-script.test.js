const assert = require("node:assert/strict");
const vm = require("node:vm");
const { buildUnifiedSource } = require("../scripts/build-unified-script");

const source = buildUnifiedSource();
assert.doesNotMatch(source, /\bimportModule\s*\(/);
assert.match(source, /name: "英雄联盟比赛赛程表"/);
assert.match(source, /version: "4\.0\.1"/);
const now = new Date("2027-10-26T12:00:00.000Z");
const files = new Map();
const key = "fixture-key-not-a-credential";
let storedKey = key;
let calls = 0;
let failRequest = false;
const alertChoices = [];
const menus = [];
const event = {
  matchId: "lol-match-1727",
  startTime: "2027-10-27T10:00:00.000Z",
  state: "unstarted",
  type: "match",
  blockName: "Swiss",
  tournamentId: "lol-worlds_2027",
  leagueId: "lol-worlds",
  leagueName: "Worlds",
  teams: [
    { slug: "tbd", name: "To Be Determined", code: "TBD", score: 0 },
    { slug: "t1", name: "T1", code: "T1", score: 0 },
  ],
  strategy: { type: "bestOf", count: 3 },
};
const page = {
  success: true,
  data: {
    leagueId: "lol-worlds",
    leagueName: "Worlds",
    total: 1,
    count: 1,
    limit: 100,
    offset: 0,
    hasMore: false,
    events: [event],
  },
};
const RuntimeDate = class extends Date {
  constructor(...args) {
    super(args.length ? args[0] : now);
  }
  static now() {
    return now.getTime();
  }
};
const fm = {
  documentsDirectory: () => "/local",
  joinPath: (dir, name) => `${dir}/${name}`,
  fileExists: (path) => files.has(path),
  readString: (path) => files.get(path),
  writeString: (path, value) => files.set(path, value),
  copy: (from, to) => {
    if (files.has(to)) throw new Error("destination exists");
    files.set(to, files.get(from));
  },
  move: (from, to) => {
    if (files.has(to)) throw new Error("destination exists");
    files.set(to, files.get(from));
    files.delete(from);
  },
  remove: (path) => files.delete(path),
};
const context = {
  console,
  Date: RuntimeDate,
  Set,
  config: { runsInWidget: true, widgetFamily: "medium" },
  args: { widgetParameter: "" },
  FileManager: { local: () => fm },
  Keychain: {
    contains: (name) => name === "lpl-schedule-personal-cito-api-key",
    get: () => storedKey,
    set: (_name, value) => {
      storedKey = value;
    },
  },
  Request: class {
    constructor(url) {
      assert.match(url, /^https:\/\/api\.citoapi\.com\//);
      assert.match(url, /from=2027-01-01&to=2027-12-31/);
    }
    async loadJSON() {
      calls++;
      assert.equal(this.headers["x-api-key"], storedKey);
      if (failRequest) throw new Error("fixture network failure");
      this.response = { statusCode: 200 };
      return page;
    }
  },
  Timer: { schedule: () => ({ invalidate() {} }) },
  Alert: class {
    addAction() {}
    addCancelAction() {}
    addDestructiveAction() {}
    addSecureTextField() {}
    textFieldValue() {
      return "rejected-new-key";
    }
    async present() {
      menus.push(this.title);
      return alertChoices.length ? alertChoices.shift() : -1;
    }
  },
};
vm.runInNewContext(
  source.replace(
    /await main\(\);\s*$/,
    "globalThis.__test = { APP, loadSchedule, loadPersonalCitoWorldsSchedule, applyUserSettings, normalizeUserSettings, selectScheduleResult, personalCitoKey, presentUnifiedSettings, presentPersonalCitoSetup };"
  ),
  context
);
async function verify() {
  assert.equal(context.__test.APP.name, "英雄联盟比赛赛程表");
  assert.equal(context.__test.personalCitoKey(), key);
  context.__test.applyUserSettings(
    context.__test.normalizeUserSettings({ personalCito: true })
  );
  const data = await context.__test.loadSchedule();
  assert.equal(data.tournament.id, "worlds-2027");
  assert.equal(data.tournament.season, "2027");
  assert.equal(data.matches[0].left, "TBD");
  assert.equal(data.matches[0].right, "T1");
  assert.equal(data.matches[0].matchType, "BO3");
  assert.equal(data.coverageVerified, false);
  assert.equal(
    context.__test.selectScheduleResult(data).tournament.shortName,
    "WORLDS · 部分"
  );
  assert.equal(calls, 1);
  await context.__test.loadSchedule();
  assert.equal(calls, 1, "fresh cache must avoid a second request");
  assert.ok(
    files.has("/local/lpl-worlds-cito-personal-v1.json"),
    "old personal cache path must be preserved"
  );
  const refreshed = await context.__test.loadPersonalCitoWorldsSchedule({
    forceRefresh: true,
  });
  assert.equal(refreshed.observedMatchCount, 1);
  assert.equal(
    calls,
    2,
    "existing cache must be replaceable on Scriptable FileManager"
  );
  await context.__test.presentUnifiedSettings();
  assert.deepEqual(menus, ["英雄联盟比赛赛程表"]);
  failRequest = true;
  alertChoices.push(2, 0);
  await context.__test.presentPersonalCitoSetup(
    context.__test.normalizeUserSettings({ personalCito: true })
  );
  assert.equal(
    storedKey,
    key,
    "failed Key replacement must preserve the old Keychain credential"
  );
  assert.ok(files.has("/local/lpl-worlds-cito-personal-v1.json"));
  console.log(
    "unified script: independent 2027 Cito schedule and old cache path ok"
  );
}
verify().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
