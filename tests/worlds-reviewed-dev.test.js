const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const designSystem = require("../LPL-Design-System");
const {
  buildBundle,
  buildDevMainSource,
  installerSource,
} = require("../scripts/build-dev-installer");

const source = fs.readFileSync(
  path.join(__dirname, "../LPL-Schedule.js"),
  "utf8"
);
const context = {
  args: { queryParameters: {}, widgetParameter: "dev:worlds-reviewed" },
  importModule: () => designSystem,
  console,
};
vm.runInNewContext(
  source.replace(
    /await main\(\);\s*$/,
    "globalThis.__reviewedTest = { normalizeReviewedWorlds, selectScheduleResult, devFixtureKey };"
  ),
  context
);
const api = context.__reviewedTest;
const now = new Date("2026-10-16T10:00:00Z");
const officialUrl = "https://lolesports.com/en-US/leagues/worlds";
const makeMatch = (id, startTime, left, right, leftId, rightId) => ({
  id,
  tournamentId: "worlds-2026",
  startTime,
  left,
  right,
  status: "upcoming",
  matchType: "BO5",
  stage: "Play-Ins",
  leftScore: null,
  rightScore: null,
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
const reviewed = {
  schemaVersion: 1,
  classification: "PARTIAL_OBSERVED",
  observedAt: "2026-10-16T09:00:00.000Z",
  sourceUrl: officialUrl,
  bodySha256: "a".repeat(64),
  coverageStart: "2026-10-16",
  coverageEnd: "2026-10-19",
  matches: [
    makeMatch(
      "111111111111111111",
      "2026-10-17 02:00:00",
      "KC",
      "MVK",
      "123",
      "456"
    ),
    makeMatch(
      "222222222222222222",
      "2026-10-18 02:00:00",
      "TBD",
      "TBD",
      "0",
      "0"
    ),
    makeMatch(
      "333333333333333333",
      "2026-10-19 02:00:00",
      "TBD",
      "KC",
      "0",
      "123"
    ),
  ],
};

assert.equal(api.devFixtureKey(), null); // Formal script never accepts a DEV parameter.
const devContext = {
  args: { queryParameters: {}, widgetParameter: "dev:worlds-reviewed" },
  importModule: () => designSystem,
  console,
};
vm.runInNewContext(
  buildDevMainSource().replace(
    /await main\(\);\s*$/,
    "globalThis.__reviewedDevKey = devFixtureKey();"
  ),
  devContext
);
assert.equal(devContext.__reviewedDevKey, "worlds-reviewed");
class FakeWidget {
  constructor() {
    this.texts = [];
  }
  setPadding() {}
  addSpacer() {}
  addText(text) {
    const item = { text };
    this.texts.push(item);
    return item;
  }
  addStack() {
    return {
      layoutHorizontally() {},
      centerAlignContent() {},
      addStack: () => ({}),
      addSpacer() {},
      addText: (text) => this.addText(text),
    };
  }
}
const errorContext = {
  args: { queryParameters: {}, widgetParameter: "dev:worlds-reviewed" },
  importModule: () => ({ ...designSystem, applyCardBackground() {} }),
  ListWidget: FakeWidget,
  Color: class {},
  Size: class {},
  Font: {
    mediumSystemFont: () => null,
    boldSystemFont: () => null,
  },
  console,
};
vm.runInNewContext(
  buildDevMainSource().replace(
    /await main\(\);\s*$/,
    "globalThis.__renderReviewedError = renderError;"
  ),
  errorContext
);
const unavailable = errorContext.__renderReviewedError(new Error("expired"));
assert.equal(unavailable.url, officialUrl);
assert.ok(unavailable.texts.some((item) => item.text === "赛程暂不可用"));
const normalized = api.normalizeReviewedWorlds(reviewed, now);
assert.equal(normalized.tournament.id, "worlds-2026");
assert.equal(normalized.matches.length, 3);
assert.equal(normalized.matches[1].left, "TBD");
assert.equal(normalized.matches[1].right, "TBD");
assert.equal(normalized.coverageLabel, "仅 10/16–10/19 已观察");
assert.equal(
  api.normalizeReviewedWorlds(
    { ...reviewed, reviewedAt: reviewed.observedAt },
    now
  ).coverageLabel,
  "仅 10/16–10/19 已观察 · 10/16更新"
);
const selected = api.selectScheduleResult(normalized, now);
assert.equal(selected.dateString, "2026-10-17");
assert.equal(selected.matches[0].left, "KC");
assert.equal(selected.coverageLabel, normalized.coverageLabel);
const later = new Date("2026-10-17T00:30:00Z");
const laterResult = api.normalizeReviewedWorlds(reviewed, later);
assert.deepEqual(
  Array.from(laterResult.matches, (match) => match.id),
  ["222222222222222222", "333333333333333333"]
);
assert.equal(
  api.selectScheduleResult(laterResult, later).dateString,
  "2026-10-18"
);
assert.throws(
  () =>
    api.normalizeReviewedWorlds(
      { ...reviewed, matches: [reviewed.matches[0]] },
      later
    ),
  /没有仍可显示的比赛/
);

for (const [mutation, expected] of [
  [(value) => (value.classification = "AVAILABLE"), /部分/],
  [(value) => (value.observedAt = "2026-10-12T09:00:00.000Z"), /过期/],
  [(value) => value.matches.push(value.matches[0]), /重复/],
  [(value) => (value.matches[1].participants.right.id = "123"), /无效/],
  [(value) => (value.matches[0].startTime = "2026-10-20 02:00:00"), /范围/],
]) {
  const changed = JSON.parse(JSON.stringify(reviewed));
  mutation(changed);
  assert.throws(() => api.normalizeReviewedWorlds(changed, now), expected);
}

const bundle = buildBundle(undefined, reviewed);
assert.ok(bundle.dataFiles["worlds-reviewed.json"]);
const packagedContext = {
  args: { queryParameters: {}, widgetParameter: "" },
  importModule: () => designSystem,
  console,
};
vm.runInNewContext(
  bundle.scripts["LPL Schedule DEV.js"].replace(
    /await main\(\);\s*$/,
    "globalThis.__packagedFixture = devFixtureKey();"
  ),
  packagedContext
);
assert.equal(packagedContext.__packagedFixture, "worlds-reviewed");
const reviewedOverrideContext = {
  args: { queryParameters: {}, widgetParameter: "dev:lpl-playoffs" },
  importModule: () => designSystem,
  console,
};
vm.runInNewContext(
  bundle.scripts["LPL Schedule DEV.js"].replace(
    /await main\(\);\s*$/,
    "globalThis.__packagedFixture = devFixtureKey();"
  ),
  reviewedOverrideContext
);
assert.equal(reviewedOverrideContext.__packagedFixture, "worlds-reviewed");
assert.equal(
  JSON.parse(bundle.dataFiles["worlds-reviewed.json"]).matches.length,
  3
);
assert.equal(buildBundle().dataFiles["worlds-reviewed.json"], undefined);
const safeBundle = buildBundle(undefined, null, true);
assert.equal(safeBundle.mode, "WORLDS_SAFE");
assert.match(installerSource(safeBundle), /不显示未经验证的比赛/);
assert.deepEqual(Object.keys(safeBundle.dataFiles), ["worlds-reviewed.json"]);
assert.equal(
  JSON.parse(safeBundle.dataFiles["worlds-reviewed.json"]).classification,
  "UNAVAILABLE"
);
const safeContext = {
  args: { queryParameters: {}, widgetParameter: "" },
  importModule: () => designSystem,
  console,
};
vm.runInNewContext(
  safeBundle.scripts["LPL Schedule DEV.js"].replace(
    /await main\(\);\s*$/,
    "globalThis.__safeFixture = devFixtureKey();"
  ),
  safeContext
);
assert.equal(safeContext.__safeFixture, "worlds-reviewed");
const overriddenSafeContext = {
  args: { queryParameters: {}, widgetParameter: "dev:worlds" },
  importModule: () => designSystem,
  console,
};
vm.runInNewContext(
  safeBundle.scripts["LPL Schedule DEV.js"].replace(
    /await main\(\);\s*$/,
    "globalThis.__safeFixture = devFixtureKey();"
  ),
  overriddenSafeContext
);
assert.equal(overriddenSafeContext.__safeFixture, "worlds-reviewed");

// Exercise the generated Installer path and the installed DEV script together.
const cloudFiles = new Map();
const localFiles = new Map();
const cloudDirs = new Set(["/icloud"]);
const localDirs = new Set(["/local"]);
const fileManager = (files, directories, root) => ({
  documentsDirectory: () => root,
  joinPath: (left, right) => `${left}/${right}`,
  fileExists: (file) => files.has(file) || directories.has(file),
  isFileDownloaded: () => true,
  createDirectory: (directory) => directories.add(directory),
  remove: (file) => files.delete(file),
  readString: (file) => files.get(file),
  writeString: (file, content) => files.set(file, content),
});
const FileManager = {
  iCloud: () => fileManager(cloudFiles, cloudDirs, "/icloud"),
  local: () => fileManager(localFiles, localDirs, "/local"),
};
const installerContext = { FileManager };
vm.runInNewContext(
  installerSource(bundle).replace(
    /await main\(\);\s*$/,
    "globalThis.__installReviewed = installBundle;"
  ),
  installerContext
);
let runtimeNow = new Date("2026-10-16T10:00:00Z");
class RuntimeDate extends Date {
  constructor(...args) {
    super(...(args.length ? args : [runtimeNow]));
  }
  static now() {
    return runtimeNow.getTime();
  }
}

(async () => {
  await installerContext.__installReviewed();
  const expectedPath = "/icloud/LPL-Schedule-DEV/data/worlds-reviewed.json";
  assert.equal(
    cloudFiles.get(expectedPath),
    bundle.dataFiles["worlds-reviewed.json"]
  );
  const runtimeContext = {
    FileManager,
    Date: RuntimeDate,
    args: { queryParameters: {}, widgetParameter: "" },
    config: { runsInWidget: true, widgetFamily: "medium" },
    importModule: () => designSystem,
    Request: class {
      constructor() {
        throw new Error("reviewed DEV must not request GitHub");
      }
    },
    console,
  };
  vm.runInNewContext(
    cloudFiles
      .get("/icloud/LPL Schedule DEV.js")
      .replace(
        /await main\(\);\s*$/,
        "globalThis.__runtime = { devFixtureKey, devDataPath, loadSchedule };"
      ),
    runtimeContext
  );
  assert.equal(runtimeContext.__runtime.devFixtureKey(), "worlds-reviewed");
  assert.equal(
    runtimeContext.__runtime.devDataPath("worlds-reviewed.json"),
    expectedPath
  );
  const loaded = await runtimeContext.__runtime.loadSchedule();
  assert.equal(loaded.matches.length, 3);
  assert.equal(loaded.tournament.shortName, "WORLDS · 部分");

  runtimeNow = new Date("2026-10-19T10:00:00Z");
  await assert.rejects(runtimeContext.__runtime.loadSchedule(), /过期/);
  runtimeNow = new Date("2026-10-16T10:00:00Z");
  cloudFiles.set(expectedPath, "{broken-json");
  await assert.rejects(runtimeContext.__runtime.loadSchedule(), /JSON/);

  const safeInstallerContext = { FileManager };
  vm.runInNewContext(
    installerSource(safeBundle).replace(
      /await main\(\);\s*$/,
      "globalThis.__installSafe = installBundle;"
    ),
    safeInstallerContext
  );
  await safeInstallerContext.__installSafe();
  assert.equal(
    JSON.parse(cloudFiles.get(expectedPath)).classification,
    "UNAVAILABLE"
  );
  runtimeNow = new Date("2026-10-24T02:00:00Z");
  const safeRuntimeContext = {
    FileManager,
    Date: RuntimeDate,
    args: { queryParameters: {}, widgetParameter: "" },
    config: { runsInWidget: true, widgetFamily: "medium" },
    importModule: () => designSystem,
    Request: class {
      constructor() {
        throw new Error("Worlds-safe DEV must not read LPL network sources");
      }
    },
    WebView: class {
      constructor() {
        throw new Error("Worlds-safe DEV must not parse the LPL page");
      }
    },
    console,
  };
  vm.runInNewContext(
    cloudFiles
      .get("/icloud/LPL Schedule DEV.js")
      .replace(
        /await main\(\);\s*$/,
        "globalThis.__safeRuntime = { devFixtureKey, loadSchedule };"
      ),
    safeRuntimeContext
  );
  assert.equal(
    safeRuntimeContext.__safeRuntime.devFixtureKey(),
    "worlds-reviewed"
  );
  await assert.rejects(
    safeRuntimeContext.__safeRuntime.loadSchedule(),
    /部分已观察赛程/
  );
  console.log("worlds-reviewed-dev: ok");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
